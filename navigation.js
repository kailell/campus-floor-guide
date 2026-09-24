/* Shortest-path navigation over the four-floor schematic corridor graph. */
(function (root) {
  const startId = '@manual-start';

  function validPoint(point) {
    return Array.isArray(point) && point.length === 2 &&
      point.every(value => Number.isFinite(value) && value >= 0 && value <= 100);
  }

  function distance(a, b, image) {
    const dx = (a[0] - b[0]) * image.width / 100;
    const dy = (a[1] - b[1]) * image.height / 100;
    return Math.hypot(dx, dy);
  }

  function projectToEdge(point, a, b, image) {
    const ax = a[0] * image.width / 100, ay = a[1] * image.height / 100;
    const bx = b[0] * image.width / 100, by = b[1] * image.height / 100;
    const px = point[0] * image.width / 100, py = point[1] * image.height / 100;
    const dx = bx - ax, dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)) : 0;
    return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], t };
  }

  function closestCorridor(data, point) {
    let best = null;
    for (const [aId, bId] of data.edges) {
      const a = data.nodes[aId], b = data.nodes[bId];
      const projection = projectToEdge(point, a, b, data.image);
      const offset = distance(point, projection.point, data.image);
      if (!best || offset < best.offset) {
        best = { edge: [aId, bId], point: projection.point, t: projection.t, offset };
      }
    }
    return best;
  }

  function addEdge(adjacency, a, b, weight) {
    adjacency.get(a).push({ id: b, weight });
    adjacency.get(b).push({ id: a, weight });
  }

  function dedupe(points) {
    return points.filter((point, index) => index === 0 ||
      Math.abs(point[0] - points[index - 1][0]) > 0.00001 ||
      Math.abs(point[1] - points[index - 1][1]) > 0.00001);
  }

  function findRoute(data, start, targetId, targetPoint) {
    if (!validPoint(start)) throw new Error('请先在楼层图上标记当前位置');
    const destination = data.destinations[targetId];
    if (!destination) throw new Error('这个地点尚未加入导航地图');
    if (targetPoint !== undefined && !validPoint(targetPoint)) throw new Error('目标坐标无效');

    const snap = closestCorridor(data, start);
    if (!snap) throw new Error('导航地图中没有可用通道');
    const adjacency = new Map(Object.keys(data.nodes).map(id => [id, []]));
    adjacency.set(startId, []);
    for (const [a, b] of data.edges) {
      addEdge(adjacency, a, b, distance(data.nodes[a], data.nodes[b], data.image));
    }
    for (const id of snap.edge) {
      addEdge(adjacency, startId, id, distance(snap.point, data.nodes[id], data.image));
    }

    const costs = new Map([...adjacency.keys()].map(id => [id, Infinity]));
    const previous = new Map();
    const visited = new Set();
    costs.set(startId, 0);
    while (visited.size < adjacency.size) {
      let current = null;
      for (const [id, cost] of costs) {
        if (!visited.has(id) && (current === null || cost < costs.get(current))) current = id;
      }
      if (current === null || costs.get(current) === Infinity) break;
      if (current === destination.via) break;
      visited.add(current);
      for (const edge of adjacency.get(current)) {
        const nextCost = costs.get(current) + edge.weight;
        if (nextCost < costs.get(edge.id)) {
          costs.set(edge.id, nextCost);
          previous.set(edge.id, current);
        }
      }
    }
    if (costs.get(destination.via) === Infinity) return null;

    const nodeIds = [];
    for (let id = destination.via; id !== undefined; id = previous.get(id)) {
      nodeIds.push(id);
      if (id === startId) break;
    }
    nodeIds.reverse();
    const points = dedupe([
      start,
      snap.point,
      ...nodeIds.filter(id => id !== startId).map(id => data.nodes[id]),
      destination.entrance,
      ...(targetPoint ? [targetPoint] : [])
    ]);
    const lengthPixels = points.slice(1).reduce((sum, point, index) =>
      sum + distance(points[index], point, data.image), 0);
    return {
      targetId,
      points,
      nodeIds: nodeIds.filter(id => id !== startId),
      entrance: destination.entrance,
      snappedStart: snap.point,
      snapOffsetPixels: snap.offset,
      lengthPixels
    };
  }

  const api = { findRoute, closestCorridor, distance };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CampusNavigation = api;
})(typeof window === 'object' ? window : globalThis);
