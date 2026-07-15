#!/usr/bin/env node
/**
 * validate-skills.js
 *
 * Validates every skill under .github/skills/<name>/SKILL.md:
 *   1. Each subdirectory (except `memories`) must contain a SKILL.md file.
 *   2. SKILL.md must have YAML frontmatter delimited by `---`.
 *   3. Frontmatter must include `name` and `description` fields.
 *   4. The `name` field must match the parent directory name.
 *
 * Exit code 0 = all skills valid, 1 = one or more failures.
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.resolve(__dirname, '..', '.github', 'skills');

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const yaml = match[1];
  const fields = {};

  for (const line of yaml.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key) fields[key] = value;
  }

  return fields;
}

let failures = 0;

const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });

for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  if (entry.name === 'memories') continue;

  const skillDir = path.join(SKILLS_DIR, entry.name);
  const skillFile = path.join(skillDir, 'SKILL.md');

  // 1. Check SKILL.md exists
  if (!fs.existsSync(skillFile)) {
    console.error(`FAIL  ${entry.name}/SKILL.md — file not found`);
    failures++;
    continue;
  }

  const content = fs.readFileSync(skillFile, 'utf-8');
  const fields = parseFrontmatter(content);

  // 2. Check frontmatter exists
  if (!fields) {
    console.error(`FAIL  ${entry.name}/SKILL.md — missing YAML frontmatter (--- delimiters)`);
    failures++;
    continue;
  }

  // 3. Check required fields
  const missing = [];
  if (!fields.name) missing.push('name');
  if (!fields.description) missing.push('description');

  if (missing.length > 0) {
    console.error(`FAIL  ${entry.name}/SKILL.md — missing frontmatter field(s): ${missing.join(', ')}`);
    failures++;
    continue;
  }

  // 4. Name must match directory
  if (fields.name !== entry.name) {
    console.error(
      `FAIL  ${entry.name}/SKILL.md — frontmatter name "${fields.name}" does not match directory "${entry.name}"`
    );
    failures++;
    continue;
  }

  console.log(`OK    ${entry.name}/SKILL.md`);
}

if (failures > 0) {
  console.error(`\n${failures} skill(s) failed validation.`);
  process.exit(1);
} else {
  console.log(`\nAll skills validated successfully.`);
}
