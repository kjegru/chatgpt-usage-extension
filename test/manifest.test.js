import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const manifestPath = path.join(ROOT, "manifest.json");

test("manifest.json: exists and is valid JSON", () => {
  assert.ok(fs.existsSync(manifestPath), "manifest.json file must exist");
  const content = fs.readFileSync(manifestPath, "utf8");
  assert.doesNotThrow(() => JSON.parse(content), "manifest.json must be valid JSON");
});

test("manifest.json: conforms to Chrome MV3 basic schema", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.equal(manifest.manifest_version, 3, "Must be Manifest V3");
  assert.ok(typeof manifest.name === "string" && manifest.name.length > 0, "Must have a name");
  assert.ok(typeof manifest.version === "string" && /^\d+(\.\d+)*$/.test(manifest.version), "Must have valid semver version");
  assert.ok(typeof manifest.description === "string", "Must have a description");

  assert.ok(Array.isArray(manifest.permissions), "permissions must be an array");
  assert.ok(manifest.permissions.includes("storage"), "permissions must include storage");
  assert.ok(manifest.permissions.includes("alarms"), "permissions must include alarms");

  assert.ok(Array.isArray(manifest.host_permissions), "host_permissions must be an array");
  assert.ok(manifest.host_permissions.some(h => h.includes("chatgpt.com")), "Must permit chatgpt.com");
});

test("manifest.json: all referenced asset files exist on disk", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  // Background worker
  assert.ok(manifest.background?.service_worker, "Must define a background service_worker");
  const bgPath = path.join(ROOT, manifest.background.service_worker);
  assert.ok(fs.existsSync(bgPath), `Background worker missing: ${manifest.background.service_worker}`);

  // Action popup
  assert.ok(manifest.action?.default_popup, "Must define action default_popup");
  const popupPath = path.join(ROOT, manifest.action.default_popup);
  assert.ok(fs.existsSync(popupPath), `Popup file missing: ${manifest.action.default_popup}`);

  // Action icons
  for (const [size, iconRelPath] of Object.entries(manifest.action?.default_icon || {})) {
    const iconPath = path.join(ROOT, iconRelPath);
    assert.ok(fs.existsSync(iconPath), `Action icon ${size} missing at ${iconRelPath}`);
  }

  // Extension icons
  for (const [size, iconRelPath] of Object.entries(manifest.icons || {})) {
    const iconPath = path.join(ROOT, iconRelPath);
    assert.ok(fs.existsSync(iconPath), `Icon ${size} missing at ${iconRelPath}`);
  }

  // Content scripts
  assert.ok(Array.isArray(manifest.content_scripts), "content_scripts must be an array");
  for (const cs of manifest.content_scripts) {
    for (const js of cs.js || []) {
      const jsPath = path.join(ROOT, js);
      assert.ok(fs.existsSync(jsPath), `Content script JS missing: ${js}`);
    }
    for (const css of cs.css || []) {
      const cssPath = path.join(ROOT, css);
      assert.ok(fs.existsSync(cssPath), `Content script CSS missing: ${css}`);
    }
  }
});
