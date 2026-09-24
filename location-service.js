// Browser geolocation adapter. It reports a bounded wait even when permission
// prompts or a device provider never invoke a watchPosition callback.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CampusLocationService = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const advice = {
    insecure: '请使用 HTTPS 网址打开，不要使用本地文件或受限制的预览页面。',
    unsupported: '请换用支持定位的浏览器，或在楼层图上选择已知地点。',
    denied: '请在浏览器的网站权限中允许定位，并检查系统定位服务；微信内打开时也可尝试系统浏览器。',
    unavailable: '请开启手机或电脑的系统定位服务、Wi-Fi/移动网络，并到室外或窗边重试。',
    timeout: '设备暂未返回位置。已尝试普通精度定位；可检查系统定位服务或手动选择位置。',
    waiting: '请处理浏览器定位授权弹窗；若没有弹窗，请检查网站权限和系统定位服务。'
  };

  function create(options) {
    const { geolocation, permissions, secureContext, onState, onFix,
      schedule = setTimeout, cancel = clearTimeout } = options;
    let highWatch = null, lowWatch = null, watchdog = null, run = 0;
    let permission = 'unknown', phase = 'idle';
    let lastError = null, lastFix = null, active = false;
    const supported = !!geolocation && typeof geolocation.watchPosition === 'function';

    function snapshot(extra = {}) {
      return { phase, permission, secureContext: !!secureContext, geolocationAvailable: supported,
        mode: lowWatch === null ? 'high' : 'fallback', lastError,
        accuracyMeters: lastFix ? lastFix.coords.accuracy : null,
        updatedAt: lastFix ? lastFix.timestamp : null, ...extra };
    }
    function report(next, extra) { phase = next; onState(snapshot(extra)); }
    function clearWatch(id) { if (id !== null && supported) geolocation.clearWatch(id); }
    function clearTimer() { if (watchdog !== null) { cancel(watchdog); watchdog = null; } }
    function stop() {
      run++; active = false; clearWatch(highWatch); clearWatch(lowWatch);
      highWatch = null; lowWatch = null; clearTimer(); report('stopped');
    }
    function fail(code, message, guidance) {
      lastError = { code, message, advice: guidance };
      report('error');
    }
    function accept(position, mode, token) {
      if (!active || token !== run) return;
      lastFix = position; lastError = null; clearTimer();
      if (mode === 'high') { clearWatch(lowWatch); lowWatch = null; }
      onFix(position, mode); report('live', { mode });
    }
    function lowAccuracy(token) {
      if (!active || token !== run || lowWatch !== null) return;
      report('fallback');
      try {
        lowWatch = geolocation.watchPosition(
          position => accept(position, 'fallback', token),
          error => handleError(error, 'fallback', token),
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 10000 }
        );
      } catch (error) { fail('UNAVAILABLE', String(error), advice.unavailable); }
    }
    function handleError(error, mode, token) {
      if (!active || token !== run) return;
      const code = error && error.code;
      if (code === 1) {
        stop(); fail('PERMISSION_DENIED', '浏览器拒绝了定位权限', advice.denied);
      } else if (code === 2) {
        lastError = { code: 'POSITION_UNAVAILABLE', message: mode === 'high' ?
          '高精度定位暂时不可用' : '设备暂时无法提供位置', advice: advice.unavailable };
        if (mode === 'high') lowAccuracy(token);
        else report('error');
      } else if (code === 3) {
        lastError = { code: 'TIMEOUT', message: mode === 'high' ?
          '高精度定位超时' : '普通精度定位也已超时', advice: advice.timeout };
        if (mode === 'high') lowAccuracy(token);
        else report('error');
      } else fail('UNKNOWN', '定位服务返回未知错误', advice.unavailable);
    }
    function observePermission(token) {
      if (!permissions || typeof permissions.query !== 'function') {
        permission = 'unsupported'; report(phase); return;
      }
      Promise.resolve().then(() => permissions.query({ name: 'geolocation' })).then(result => {
        if (token !== run) return;
        permission = result.state || 'unknown'; report(phase);
        result.onchange = () => {
          if (token !== run) return;
          permission = result.state || 'unknown'; report(phase);
          if (permission === 'denied' && active) { stop(); fail('PERMISSION_DENIED', '浏览器定位权限已被关闭', advice.denied); }
        };
        if (permission === 'denied' && active) { stop(); fail('PERMISSION_DENIED', '浏览器定位权限已被拒绝', advice.denied); }
      }).catch(() => { if (token === run) { permission = 'unsupported'; report(phase); } });
    }
    function start() {
      if (active) return;
      if (!secureContext) { fail('INSECURE_CONTEXT', '当前页面不是安全上下文', advice.insecure); return; }
      if (!supported) { fail('UNSUPPORTED', '浏览器没有提供 navigator.geolocation', advice.unsupported); return; }
      active = true; lastError = null; lastFix = null; const token = ++run; report('requesting'); observePermission(token);
      try {
        highWatch = geolocation.watchPosition(
          position => accept(position, 'high', token),
          error => handleError(error, 'high', token),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
        );
      } catch (error) { active = false; fail('START_FAILED', String(error), advice.denied); return; }
      watchdog = schedule(() => {
        if (!active || token !== run || lastFix) return;
        lastError = { code: 'NO_CALLBACK', message: '定位请求尚未收到浏览器回应', advice: advice.waiting };
        report('waiting');
        if (permission === 'granted') lowAccuracy(token);
      }, 16000);
    }
    return { start, stop, retry: () => { stop(); start(); }, getState: () => snapshot(),
      isActive: () => active, advice };
  }
  return { create, advice };
});
