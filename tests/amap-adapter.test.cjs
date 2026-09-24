const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('AMap adapter converts GPS coordinates before blue dot and walking route', async () => {
  const calls = { conversions: [], walks: [] };
  const point = { getLng: () => 120.21, getLat: () => 30.11 };
  class Map {
    constructor() { calls.map = this; }
    on() {}
    add(items) { calls.overlays = items; }
    setCenter(value) { calls.center = value; }
  }
  class CircleMarker { constructor(options) { calls.dot = options; } setCenter(value) { calls.dotCenter = value; } }
  class Circle { constructor(options) { calls.accuracy = options; } setCenter() {} setRadius() {} }
  class Walking {
    clear() {}
    search(start, end, callback) {
      calls.walks.push({ start, end });
      callback('complete', { routes: [{}] });
    }
  }
  const AMap = { Map, CircleMarker, Circle, Walking,
    convertFrom(coords, type, callback) {
      calls.conversions.push({ coords, type });
      callback('complete', { info: 'ok', locations: [point] });
    }
  };
  const root = { CampusPlaces: { hasCoordinate: value => Number.isFinite(value.latitude) && Number.isFinite(value.longitude) } };
  const document = {
    createElement: () => ({}),
    head: { append() { root.AMap = AMap; queueMicrotask(() => root.__campusAmapReady()); } }
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'amap-adapter.js'), 'utf8');
  vm.runInNewContext(source, { window: root, document, setTimeout, clearTimeout,
    Promise, encodeURIComponent });
  const adapter = root.CampusOutdoorMap.create({ element: {},
    config: { amapKey: 'public-key', amapServiceHost: 'https://proxy.example/_AMapService' },
    onStatus: () => {} });
  assert.equal(await adapter.load(), true);
  adapter.updateGps({ longitude: 120.2, latitude: 30.1, accuracy: 25 });
  assert.equal(calls.conversions[0].type, 'gps');
  assert.equal(calls.conversions[0].coords[0], 120.2);
  assert.equal(calls.center, point);
  assert.equal(calls.accuracy.radius, 25);
  await adapter.routeTo({ entrances: [{ id: 'door', verified: true,
    longitude: 120.22, latitude: 30.12, coordinateSystem: 'gcj02' }] });
  assert.equal(calls.walks[0].start, point);
  assert.equal(calls.walks[0].end[0], 120.22);
});

test('AMap adapter stays unavailable without a proxy configuration', async () => {
  const messages = [];
  const root = {};
  const source = fs.readFileSync(path.join(__dirname, '..', 'amap-adapter.js'), 'utf8');
  vm.runInNewContext(source, { window: root, document: {}, setTimeout, clearTimeout,
    Promise, encodeURIComponent });
  const adapter = root.CampusOutdoorMap.create({ element: {},
    config: { amapKey: '', amapServiceHost: '' },
    onStatus: (message, error) => messages.push({ message, error }) });
  assert.equal(await adapter.load(), false);
  assert.equal(messages[0].error, true);
});
