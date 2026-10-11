#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { VERSION, listScenarios, createFixture } from '../src/index.mjs';
const usage = `Repo Fixtures ${VERSION}\n\nUsage:\n  repo-fixtures list [--json]\n  repo-fixtures create <scenario> <new-directory> [--json]\n\nRequires Git 2.28+ and Node 24.8+. Creates synthetic repositories only in a new directory.\nNever launches a consumer tool or removes a repository. Parent directory must exist.\nExit codes: 0 success; 2 invalid input or creation error.\n`;
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, strict: true, options: { help: { type: 'boolean' }, version: { type: 'boolean' }, json: { type: 'boolean' } } });
  if (values.help || !positionals.length && !values.version) console.log(usage);
  else if (values.version) console.log(VERSION);
  else if (positionals[0] === 'list' && positionals.length === 1) {
    const list = listScenarios(); console.log(values.json ? JSON.stringify({ version: 1, scenarios: list }, null, 2) : list.map(item => `${item.id}\t${item.description}`).join('\n'));
  } else if (positionals[0] === 'create' && positionals.length === 3) {
    const result = await createFixture(positionals[1], positionals[2]);
    console.log(values.json ? JSON.stringify(result, null, 2) : `Created ${result.manifest.scenario}: ${result.repository}\nExpected facts and observed Git state: ${result.directory}/fixture.json`);
  } else throw new Error('Invalid command. Run repo-fixtures --help.');
} catch (error) { console.error(`Repo Fixtures: ${error.message}`); process.exitCode = 2; }
