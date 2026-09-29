import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvasClient } from '../src/core.mjs';
import { createServer } from '../src/server.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const origin = 'https://school.instructure.com';
const json = (data, headers = {}) => new Response(JSON.stringify(data), { headers });
const courses = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: `Class ${i + 1}`, time_zone: 'America/Los_Angeles', syllabus_body: '<p>Teacher policy.</p>' }));

test('overview carries class context, separate due/lock dates, pagination and bounded parallel reads', async () => {
  const calls = []; let active = 0; let peak = 0;
  const client = createCanvasClient({ origin, token: 'secret', fetchImpl: async (url, options) => {
    calls.push(String(url));
    assert.equal(options.cache, 'no-store');
    if (url.pathname === '/api/v1/courses') {
      assert.equal(url.searchParams.get('include[]'), 'syllabus_body');
      assert.equal(url.searchParams.get('page'), '2');
      return json(courses, { link: `<${origin}/api/v1/courses?page=3>; rel="next"` });
    }
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5)); active--;
    return json([{ id: 81, name: 'Paper quiz', description: 'not in overview', due_at: '2026-10-01T16:00:00Z', lock_at: '2026-10-02T06:59:00Z', submission_types: ['on_paper'], submission: { workflow_state: 'unsubmitted', body: 'private answer', user_id: 9 } }], { link: `<${origin}/api/v1/assignments?page=2>; rel="next"` });
  }});
  const result = await client.get_study_overview({ page: 2 });
  assert.equal(calls.length, 13); assert.equal(peak, 6); assert.equal(result.nextPage, 3);
  assert.equal(result.data[0].syllabus.excerpt, 'Teacher policy.');
  assert.equal(result.data[0].syllabus.coverage, 'complete_body');
  const upcoming = result.data[0].assignments.upcoming;
  assert.ok(upcoming.checkedAt); assert.equal(upcoming.moreAvailable, true);
  assert.notEqual(upcoming.data[0].due_at, upcoming.data[0].lock_at);
  assert.equal(upcoming.data[0].submission.body, undefined);
  assert.equal(result.contentIsUntrusted, true);
  assert.ok(!JSON.stringify(result).includes('secret'));
  assert.match(result.guidance, /not proof of missed work/);
});

test('missing, partial and inaccessible sources never appear complete', async () => {
  const client = createCanvasClient({ origin, token: 'x', fetchImpl: async url => {
    if (url.pathname === '/api/v1/courses') return json([{ id: 1, name: 'A', syllabus_body: 'x'.repeat(9000) }, { id: 2, name: 'B' }]);
    if (url.pathname.includes('/courses/2/')) return new Response('private school message', { status: 403 });
    return json(Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: 'Work' })));
  }});
  const result = await client.get_study_overview();
  assert.equal(result.data[0].syllabus.coverage, 'excerpt');
  assert.equal(result.data[1].syllabus.coverage, 'not_provided');
  assert.equal(result.data[0].assignments.upcoming.data.length, 3);
  assert.equal(result.data[0].assignments.overdue.data.length, 2);
  assert.equal(result.data[0].assignments.upcoming.moreAvailable, true);
  assert.equal(result.data[1].assignments.upcoming.coverage, 'unavailable');
  assert.ok(!JSON.stringify(result).includes('private school message'));
  assert.match(result.coverage, /Undated work/);
});

test('expired access fails closed and invalid pagination makes no school request', async () => {
  let reads = 0;
  const client = createCanvasClient({ origin, token: 'x', fetchImpl: async url => {
    reads++;
    return url.pathname === '/api/v1/courses' ? json([courses[0]]) : new Response('secret', { status: 401 });
  }});
  await assert.rejects(client.get_study_overview({ page: -1 })); assert.equal(reads, 0);
  await assert.rejects(client.get_study_overview(), error => error.status === 401);
});

test('an empty school has explicit zero coverage with no assignment fanout', async () => {
  let reads = 0;
  const client = createCanvasClient({ origin, token: 'x', fetchImpl: async () => { reads++; return json([]); } });
  const result = await client.get_study_overview();
  assert.deepEqual(result.data, []); assert.equal(result.nextPage, null); assert.equal(reads, 1);
});

test('real MCP client can orient in one metered tool call', async () => {
  let metered = 0;
  const canvas = createCanvasClient({ origin, token: 'x', fetchImpl: async url => json(url.pathname === '/api/v1/courses' ? [courses[0]] : []) });
  const server = createServer(canvas, { beforeCall: async () => { metered++; } });
  const assistant = new Client({ name: 'test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), assistant.connect(b)]);
  try {
    assert.match(assistant.getInstructions(), /begin with get_study_overview/);
    const result = await assistant.callTool({ name: 'get_study_overview', arguments: {} });
    assert.equal(result.isError, undefined);
    assert.equal(JSON.parse(result.content[0].text).data[0].name, 'Class 1');
    assert.equal(metered, 1);
  } finally { await assistant.close(); await server.close(); }
});
