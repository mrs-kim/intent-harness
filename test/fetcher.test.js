"use strict";

/**
 * test/fetcher.test.js
 *
 * Tests for src/agents/lib/fetcher.js
 * Uses lightweight content to stay within memory constraints.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.resolve(__dirname, "..");
const { fetchSources, chunkDocument, summarizeForDomainId } = require(
  path.join(ROOT, "src", "agents", "lib", "fetcher")
);

describe("chunkDocument()", () => {
  test("returns single chunk for short documents", () => {
    const chunks = chunkDocument("Short document content.", 1000);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0], "Short document content.");
  });

  test("splits documents longer than chunk size", () => {
    // 3 paragraphs each ~100 chars, chunk size 150
    const content = "Para one content here.\n\nPara two content here.\n\nPara three content here.";
    const chunks = chunkDocument(content, 40, 10);
    assert.ok(chunks.length > 1, `Expected multiple chunks, got ${chunks.length}`);
  });

  test("no content is lost across chunks", () => {
    const content = "Alpha section.\n\nBeta section.\n\nGamma section.";
    const chunks = chunkDocument(content, 25, 5);
    const combined = chunks.join(" ");
    assert.ok(combined.includes("Alpha"));
    assert.ok(combined.includes("Gamma"));
  });
});

describe("fetchSources()", () => {
  test("reads a markdown file", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-f-"));
    const filePath = path.join(tmpDir, "spec.md");
    fs.writeFileSync(filePath, "# Spec\n\nSome content.");
    try {
      const docs = await fetchSources([filePath]);
      assert.equal(docs.length, 1);
      assert.ok(docs[0].content.includes("Spec"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("reads multiple files", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-f-"));
    fs.writeFileSync(path.join(tmpDir, "a.md"), "Content A");
    fs.writeFileSync(path.join(tmpDir, "b.txt"), "Content B");
    try {
      const docs = await fetchSources([
        path.join(tmpDir, "a.md"),
        path.join(tmpDir, "b.txt"),
      ]);
      assert.equal(docs.length, 2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("reads files from a directory", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-f-"));
    fs.writeFileSync(path.join(tmpDir, "a.md"), "Content A");
    fs.writeFileSync(path.join(tmpDir, "b.md"), "Content B");
    try {
      const docs = await fetchSources([tmpDir]);
      assert.ok(docs.length >= 2, `Expected >= 2 docs, got ${docs.length}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("skips missing files without crashing", async () => {
    const docs = await fetchSources(["/nonexistent/path/spec.md"]);
    assert.equal(docs.length, 0);
  });

  test("strips HTML tags", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-f-"));
    const filePath = path.join(tmpDir, "page.html");
    fs.writeFileSync(filePath, "<h1>Title</h1><p>Content.</p>");
    try {
      const docs = await fetchSources([filePath]);
      assert.ok(!docs[0].content.includes("<h1>"));
      assert.ok(docs[0].content.includes("Title"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("skips empty files", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-f-"));
    fs.writeFileSync(path.join(tmpDir, "empty.md"), "   \n  ");
    try {
      const docs = await fetchSources([tmpDir]);
      assert.equal(docs.length, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("summarizeForDomainId()", () => {
  test("combines documents", () => {
    const docs = [
      { source: "a.md", content: "Auth login content", chunks: [] },
      { source: "b.md", content: "Billing payment content", chunks: [] },
    ];
    const summary = summarizeForDomainId(docs);
    assert.ok(summary.includes("Auth login content"));
    assert.ok(summary.includes("Billing payment content"));
    assert.ok(summary.includes("a.md"));
  });

  test("truncates very long content", () => {
    const docs = [
      { source: "a.md", content: "x".repeat(15000), chunks: [] },
      { source: "b.md", content: "y".repeat(15000), chunks: [] },
    ];
    const summary = summarizeForDomainId(docs, 10000);
    assert.ok(summary.length <= 12000, `Summary too long: ${summary.length}`);
    assert.ok(summary.includes("a.md"));
    assert.ok(summary.includes("b.md"));
  });
});
