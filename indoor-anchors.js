// Map-derived coordinates are candidates for on-site QR placement, not surveyed facts.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CampusIndoorAnchors = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const anchors = [
    { id: 'C-F4-WEST-STAIR', building: 'C', floor: '4',
      name: 'C 楼四楼西侧楼梯', x: 15.7, y: 61,
      navigationNode: 'l16_61', verified: false }
  ];
  const find = id => anchors.find(anchor => anchor.id === id) || null;
  function validate(anchor, graph) {
    return !!anchor && !!graph && graph.nodes[anchor.navigationNode] &&
      anchor.building === 'C' && anchor.floor === '4' &&
      Number.isFinite(anchor.x) && anchor.x >= 0 && anchor.x <= 100 &&
      Number.isFinite(anchor.y) && anchor.y >= 0 && anchor.y <= 100;
  }
  return { anchors, find, validate };
});
