# 校园与 C 楼四楼混合导航

GitHub Pages 静态网站。保留四楼原图、31 个标记、教室搜索、示意路线、手动箭头；新增校园室外地图适配层、二维码锚点和完整定位诊断。

## 使用流程

1. 打开网站后自动请求设备定位；“定位诊断”显示权限、错误代码、精度和解决建议。
2. 搜索校园地点或教室。校园地图在高德配置完成后显示设备蓝点、精度圈和到已核对入口的步行路线。
3. 进入 C 楼四楼时，优先采用室内定位服务，再使用二维码、已知地点，最后可手动标记。
4. 点击教室“开始导航到这里”；有四楼起点时显示原有蓝色示意路线。修改起点后路线重新计算。

`location-service.js` 从高精度 `watchPosition` 开始；超时或无法取得位置时增加普通精度后备监听，同时保留高精度监听。独立的 16 秒看门狗避免授权弹窗或设备无回调时无限停留在“正在定位”。权限查询失败不阻止定位本身。

楼层图没有地理配准，也没有室内定位设备，因此 GPS **无法得出四楼图上的精确位置**。仅有 GPS 时，页面显示设备定位状态，不会凭空绘制一个房间位置。二维码或已知地点确认后显示图上箭头；手动标记是最后兜底。重新打开网页时保留的箭头标为“上次手动位置”。

## 统一位置模型

`location-model.js` 中一条记录可包含设备、校园和室内信息：

```js
{
  type: 'current',
  latitude: 30.1, longitude: 120.2,
  gpsAccuracyMeters: 35, gpsUpdatedAt: 1700000000000,
  building: 'C', entrance: 'C-MAIN',
  floor: '4', x: 15.7, y: 61,
  navigationNode: 'l16_61', anchorId: 'C-F4-WEST-STAIR',
  indoorSource: 'qr', indoorAccuracyMeters: null,
  indoorUpdatedAt: 1700000000000, updatedAt: 1700000000000
}
```

未知字段用 `null`。GPS 更新保留楼内位置，但不会修改楼层 `x/y`；建筑与入口只在用户确认或真实锚点定位后写入当前位置。室内来源优先级为 `indoor > qr > known > manual`。未来的室内定位服务可调用 `CampusGuide.setIndoorPosition({building:'C',floor:'4',x,y,navigationNode,accuracyMeters,updatedAt})`，触发原有路线重新计算。GPS 经纬度不写入本地存储或上传本站服务器；高德地图服务启动后会收到地图与路线请求。

## 高德地图配置与当前缺口

`campus-config.js` 中的 Web(JS API) Key 和 HTTPS `amapServiceHost` 目前为空，因此线上网站会明确提示“校园底图尚未配置”，四楼功能照常使用。高德新申请的 JS API Key 需要配套安全密钥；**不要把 `securityJsCode` 写进公开仓库**。`deployment/amap-security-proxy.mjs` 提供 Cloudflare Worker 代理源码，需把密钥设为 Worker 的 `AMAP_SECURITY_JSCODE` secret，再将 Worker 的 `https://…/_AMapService` 地址和公开 Web Key 配入 `campus-config.js`。部署 Worker 前需检查域名和调用额度。

`campus-data.js` 目前只列出已知的 C 教学楼名称，入口经纬度仍是 `null`，`verified:false`。须按 [现场采集清单](FIELD_SURVEY.md) 核对并录入后，才允许以该入口为终点规划步行路线。校园地点目录支持教学楼、图书馆、食堂、宿舍、体育馆类别，但不会凭空生成学校里是否存在这些建筑及其坐标。

高德地图使用 GCJ-02；浏览器设备定位按 GPS/WGS84 处理，先调用高德 `convertFrom(..., 'gps')` 再画蓝点和计算步行路线。没有成功转换时不会将原经纬度直接画到高德底图上。

二维码地址示例：`https://kailell.github.io/campus-floor-guide/?anchor=C-F4-WEST-STAIR`。示例锚点来自上传的四楼图，尚未现场核对；扫描后页面会提示此事实。若用户最近两小时选过教室，或 URL 另含 `&target=C120406`，扫码后会自动画室内路线。

## 文件与修改原因

| 模块 | 文件 | 原因 |
| --- | --- | --- |
| 四楼地图 | `index.html`、`floor-map.jpg` | 保留已有界面、31 个标记与手动起点。 |
| 四楼路线 | `navigation-data.js`、`navigation.js`、`navigation-ui.js` | 图数据、最短路径和可视化独立；修改起点可重算路线。 |
| 定位 | `location-model.js`、`location-service.js` | 统一 GPS、校园、室内状态，区分权限、无回调、超时和不可用；提供普通精度降级。 |
| 校园地图 | `campus-data.js`、`amap-adapter.js`、`campus-config.js` | 地点数据与高德适配分离；缺少实测入口或凭据时不会伪造路线。 |
| 跨场景导航 | `hybrid-routing.js`、`hybrid-ui.js`、`indoor-anchors.js` | 选择室外或室内阶段，支持扫码位置和目标教室接续。 |

地图坐标均为图片宽高百分比。四楼房间入口与通道连接依据上传图推断，**未经现场核验**。路线不表示实际距离，也不覆盖跨楼层导航；请以现场门牌和可通行路线为准。

## 检查与部署

运行 `node --test tests/*.test.cjs` 检查位置模型、定位降级、地点目录、锚点、导航阶段选择、31 个目标入口、路径可达性和最短路径。浏览器中还需用真实手机核对定位授权/拒绝、蓝点、路线、扫码、搜索、起点更新和结束导航。设备定位需要 HTTPS、安全上下文和浏览器授权；微信等内置浏览器可能拦截权限请求。网页无法直接读取手机操作系统的定位开关，只能给出排查建议。

GitHub Pages 从 `main` 分支根目录发布，无构建步骤。新增脚本必须与 `index.html` 一起发布。安全代理是独立服务，不能托管在 GitHub Pages 中。
