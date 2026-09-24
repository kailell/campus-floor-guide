const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const data = require('../navigation-data.js');

const inside = point => Array.isArray(point) && point.length === 2 &&
  point.every(value => Number.isFinite(value) && value >= 0 && value <= 100);

test('all visible map markers have a navigation entrance', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const markerIds = [...html.matchAll(/\{id:'([^']+)'/g)].map(match => match[1]);
  assert.equal(markerIds.length, 31);
  assert.deepEqual(Object.keys(data.destinations).sort(), markerIds.sort());
});

test('walking graph is connected and coordinates are valid', () => {
  const ids = Object.keys(data.nodes);
  const links = new Map(ids.map(id => [id, []]));
  const uniqueEdges = new Set();
  for (const [id, point] of Object.entries(data.nodes)) {
    assert.ok(inside(point), `invalid node ${id}`);
  }
  for (const [a, b] of data.edges) {
    assert.ok(links.has(a) && links.has(b), `unknown edge ${a}-${b}`);
    assert.notEqual(a, b);
    const key = [a, b].sort().join('|');
    assert.ok(!uniqueEdges.has(key), `duplicate edge ${key}`);
    uniqueEdges.add(key);
    links.get(a).push(b);
    links.get(b).push(a);
  }
  const seen = new Set([ids[0]]);
  const queue = [ids[0]];
  for (const id of queue) {
    for (const next of links.get(id)) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  assert.equal(seen.size, ids.length, 'isolated corridor node');
  for (const [id, destination] of Object.entries(data.destinations)) {
    assert.ok(links.has(destination.via), `unknown entrance node for ${id}`);
    assert.ok(inside(destination.entrance), `invalid entrance for ${id}`);
  }
});
