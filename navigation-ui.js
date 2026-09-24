/* Keeps the existing map UI intact and adds a route layer on top of it. */
(function (root) {
  const data = root.CampusNavigationData;
  const navigator = root.CampusNavigation;
  const guide = root.CampusGuide;
  const startButton = document.getElementById('start-navigation');
  const routeLayer = document.getElementById('route-layer');
  const routeShadow = document.getElementById('route-shadow');
  const routeLine = document.getElementById('route-line');
  const routeStart = document.getElementById('route-start');
  const routeTarget = document.getElementById('route-target');
  const banner = document.getElementById('nav-banner');
  const bannerName = document.getElementById('nav-target-name');
  const bannerNote = document.getElementById('nav-route-note');
  let activeTarget = null;
  let pendingTarget = null;

  function stopNavigation() {
    if (activeTarget) activeTarget.button.classList.remove('target');
    activeTarget = null;
    pendingTarget = null;
    routeLayer.setAttribute('hidden', '');
    banner.hidden = true;
  }

  function setCircle(circle, point) {
    circle.setAttribute('cx', (point[0] * data.image.width / 100).toFixed(2));
    circle.setAttribute('cy', (point[1] * data.image.height / 100).toFixed(2));
  }

  function drawRoute(route, room) {
    const points = route.points.map(([x, y]) =>
      `${(x * data.image.width / 100).toFixed(2)},${(y * data.image.height / 100).toFixed(2)}`
    ).join(' ');
    routeShadow.setAttribute('points', points);
    routeLine.setAttribute('points', points);
    setCircle(routeStart, route.points[0]);
    setCircle(routeTarget, route.points.at(-1));
    const source = guide.getCurrentLocation().indoorSource;
    const sourceLabel = { qr: '二维码定位点', known: '已知地点', indoor: '室内定位点', manual: '手动标记位置' }[source] || '当前起点';
    routeLayer.setAttribute('aria-label', `从${sourceLabel}到${room.id}的示意路线`);
    routeLayer.removeAttribute('hidden');
  }

  function startNavigation(room) {
    if (!room) return;
    const start = guide.getManualPoint();
    if (!start) {
      pendingTarget = room;
      guide.beginManualMark();
      document.getElementById('map-prompt-text').textContent = `请先点地图标记起点，再前往 ${room.id}`;
      return;
    }
    let route;
    try {
      route = navigator.findRoute(data, start, room.id, [room.x, room.y],
        guide.getCurrentLocation().navigationNode);
    } catch (error) {
      bannerName.textContent = error.message;
      bannerNote.textContent = '请重新标记当前位置';
      banner.hidden = false;
      return;
    }
    if (!route) {
      bannerName.textContent = '暂时无法生成这条路线';
      bannerNote.textContent = '请重新选择起点或目标';
      banner.hidden = false;
      return;
    }
    if (activeTarget) activeTarget.button.classList.remove('target');
    activeTarget = room;
    pendingTarget = null;
    room.button.classList.add('target');
    drawRoute(route, room);
    bannerName.textContent = `前往 ${room.id}`;
    bannerNote.textContent = route.snapOffsetPixels > 120
      ? '示意路线 · 起点离通道较远，请核对现场'
      : '蓝色路线为四楼示意导航，请以现场通道为准';
    banner.hidden = false;
    guide.hideDetail();
    guide.focusMapPoint(start[0], start[1]);
  }

  startButton.addEventListener('click', () => {
    const room = guide.getSelectedRoom();
    const request = new CustomEvent('guide:navigation-requested', { detail: { room }, cancelable: true });
    if (document.dispatchEvent(request)) startNavigation(room);
  });
  document.getElementById('nav-stop').addEventListener('click', () => {
    stopNavigation(); document.dispatchEvent(new Event('guide:navigation-ended'));
  });
  document.getElementById('nav-view-start').addEventListener('click', () => {
    const point = guide.getManualPoint();
    if (point) guide.focusMapPoint(point[0], point[1]);
  });
  document.getElementById('nav-view-target').addEventListener('click', () => {
    if (activeTarget) guide.focusMapPoint(activeTarget.x, activeTarget.y);
  });

  document.addEventListener('guide:room-selected', event => {
    if (activeTarget && event.detail.room.id !== activeTarget.id) stopNavigation();
  });
  document.addEventListener('guide:mark-started', () => { if (activeTarget) banner.hidden = true; });
  document.addEventListener('guide:mark-cancelled', () => {
    pendingTarget = null;
    if (activeTarget) banner.hidden = false;
  });
  document.addEventListener('guide:position-set', () => {
    if (pendingTarget) startNavigation(pendingTarget);
    else if (activeTarget) startNavigation(activeTarget);
  });
  document.addEventListener('guide:position-cleared', stopNavigation);
  root.CampusIndoorNavigation = { startNavigation, stopNavigation };
})(window);
