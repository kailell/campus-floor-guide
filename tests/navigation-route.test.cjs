const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../navigation-data.js');
const { findRoute } = require('../navigation.js');

test('every marked destination is reachable from the left corridor', () => {
  for (const id of Object.keys(data.destinations)) {
    const route = findRoute(data, [8, 61], id);
    assert.ok(route, `no route to ${id}`);
    assert.deepEqual(route.points[0], [8, 61]);
    assert.deepEqual(route.points.at(-1), data.destinations[id].entrance);
    assert.ok(route.lengthPixels > 0);
  }
});

test('shortest path wins over a connected but longer detour', () => {
  const simple = {
    image: { width: 100, height: 100 },
    nodes: { a: [0, 0], b: [50, 0], c: [100, 0], d: [50, 50] },
    edges: [['a', 'b'], ['b', 'c'], ['a', 'd'], ['d', 'c']],
    destinations: { target: { via: 'c', entrance: [100, 0] } }
  };
  const route = findRoute(simple, [0, 0], 'target');
  assert.ok(route.nodeIds.includes('b'));
  assert.ok(!route.nodeIds.includes('d'));
  assert.equal(route.lengthPixels, 100);
});

test('manual start snaps to the closest point on a corridor segment', () => {
  const simple = {
    image: { width: 100, height: 100 },
    nodes: { a: [0, 0], b: [100, 0] },
    edges: [['a', 'b']],
    destinations: { target: { via: 'b', entrance: [100, 0] } }
  };
  const route = findRoute(simple, [25, 10], 'target');
  assert.deepEqual(route.snappedStart, [25, 0]);
  assert.deepEqual(route.points[0], [25, 10]);
  assert.deepEqual(route.points.at(-1), [100, 0]);
});

test('invalid start and missing destination return clear errors', () => {
  assert.throws(() => findRoute(data, [-1, 60], 'C120406'), /当前位置/);
  assert.throws(() => findRoute(data, [8, 61], 'unknown'), /尚未加入/);
});
