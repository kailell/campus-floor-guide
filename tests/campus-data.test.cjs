const test = require('node:test');
const assert = require('node:assert/strict');
const places = require('../campus-data.js');
const anchors = require('../indoor-anchors.js');
const graph = require('../navigation-data.js');

test('campus catalogue is searchable without invented coordinates', () => {
  assert.equal(places.search('教学楼')[0].id, 'C');
  assert.equal(places.hasCoordinate(places.find('C').entrances[0]), false);
  assert.ok(places.categories.library && places.categories.dining && places.categories.sports);
});

test('QR anchor references a real graph node and remains marked unverified', () => {
  const anchor = anchors.find('C-F4-WEST-STAIR');
  assert.ok(anchors.validate(anchor, graph));
  assert.equal(anchor.verified, false);
  assert.equal(anchors.find('missing'), null);
});
