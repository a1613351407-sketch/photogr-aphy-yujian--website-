import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve("dist/server/index.js"), "utf8");
const worker = (await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`)).default;

let response = await worker.fetch(new Request("https://example.test/api/status"), {});
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { vision: true, remote_vision: false, search: true, routes: true, transit: true, realtime_transit: false, providers: { vision: "浏览器基础识图", search: "OpenStreetMap", transit: "开放地图基础估算" } });

response = await worker.fetch(new Request("https://example.test/app.js?v=23"), {});
assert.equal(response.status, 200);
assert.equal(response.headers.get("cache-control"), "no-cache");
const appSource = await response.text();
assert.match(appSource, /openGallery/);
assert.match(appSource, /Promise\.all\(items\.map/);
assert.match(appSource, /pending: true, error: '正在查询公交…'/);
assert.match(appSource, /api\('\/api\/route'/);
assert.doesNotMatch(appSource, /defaultDeparture\(\); usePreset\('lake'\)/);
assert.match(appSource, /defaultDeparture\(\); render\(\); checkServices\(\)/);
assert.match(appSource, /analyzePhotoLocally/);
assert.match(appSource, /search_result\?keyword=/);
assert.match(appSource, /source=web_explore_feed/);
assert.match(appSource, /xhsdiscover:\/\/search\/result\?keyword=/);
assert.match(appSource, /data-copy-portrait/);
assert.match(appSource, /realtimeTransit/);

response = await worker.fetch(new Request("https://example.test/live.css?v=23"), {});
assert.equal(response.status, 200);
const liveCss = await response.text();
assert.match(liveCss, /\.modal-top \.close \{ position:absolute; top:20px; right:20px;/);
assert.match(liveCss, /#modal-content \{ max-height:calc\(88vh - 82px\); overflow-y:auto;/);

response = await worker.fetch(new Request("https://example.test/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image_data_url: "data:image/jpeg;base64,AA==" }) }), {});
assert.equal(response.status, 503);

response = await worker.fetch(new Request("https://example.test/api/analyze", { method: "POST", headers: { origin: "https://other.test", "sec-fetch-site": "cross-site", "content-type": "application/json" }, body: "{}" }), { ZHIPU_API_KEY: "test" });
assert.equal(response.status, 403);

response = await worker.fetch(new Request("https://example.test/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image_data_url: "invalid" }) }), { ZHIPU_API_KEY: "test" });
assert.equal(response.status, 422);

const originalFetch = globalThis.fetch;
let zhipuBody;
let photoFilterCalls = 0;
let webSearchCalls = 0;
const mapSearchKeywords = [];
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  if (url.hostname === "nominatim.openstreetmap.org") return Response.json([{ osm_type: "way", osm_id: 12345, name: "测试湿地公园", display_name: "测试湿地公园, 洪山区, 武汉市", lon: "114.41", lat: "30.61", category: "leisure", type: "park", address: { district: "洪山区", city: "武汉市" } }]);
  if (url.pathname === "/v3/place/text") mapSearchKeywords.push(url.searchParams.get("keywords"));
  if (url.hostname === "open.bigmodel.cn") {
    zhipuBody = JSON.parse(init.body);
    if (url.pathname.endsWith('/web_search')) {
      webSearchCalls++;
      return Response.json({search_result: [
        {title:'武汉测试湖公园人像摄影',content:'武汉测试湖公园，湖岸写真',link:'https://www.meipian.cn/test-photos',media:'美篇'},
        {title:'武汉测试湖公园',content:'武汉',link:'https://127.0.0.1/private',media:'blocked'},
        {title:'武汉测试湖公园',content:'武汉',link:'https://www.meipian.cn.evil.test/private',media:'blocked'},
        {title:'其他城市的公园',content:'其他城市',link:'https://www.sohu.com/unrelated',media:'搜狐'}
      ]});
    }
    if (zhipuBody.messages?.[0]?.role === "system") {
      assert.equal(zhipuBody.messages[1].content, "想找有芦苇的湿地湖岸，适合人像摄影");
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ tags: ["湿地", "水面", "不支持的标签"], keywords: ["芦苇", "湖岸"], summary: "适合人像摄影的芦苇湿地与湖岸" }) } }] });
    }
    if (zhipuBody.messages?.[0]?.content?.[0]?.text?.includes('环境清楚')) {
      photoFilterCalls++;
      const images = zhipuBody.messages[0].content.filter(item=>item.type==='image_url');
      return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({photos:images.map((image,index)=>({index,kind:image.image_url.url.includes('portrait')?'portrait':'landscape',score:image.image_url.url.includes('panorama')?99:80,reason:'湖岸与人物的构图'})).filter(result=>!images[result.index].image_url.url.includes('door-sign'))})}}]});
    }
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ is_landscape: true, summary: "湖面与树林", tags: ["水面", "树林"], season: "夏季观感", light: "日间柔光", confidence: 0.92, caution: "季节仅为视觉判断" }) } }] });
  }
  if (url.hostname === 'www.meipian.cn') return new Response('<html><title>武汉测试湖公园人像摄影</title><meta property="og:image" content="https://www.meipian.cn/panorama.jpg"><img data-src="https://www.meipian.cn/portrait-1.jpg"><img src="https://www.meipian.cn/portrait-2.jpg"><img src="https://www.meipian.cn/logo.png"><img src="https://127.0.0.1/private.jpg"></html>', {headers:{'content-type':'text/html'}});
  if (url.hostname === "commons.wikimedia.org") return Response.json({ query: { pages: Array.from({ length: 20 }, (_, index) => ({
    title: `File:武汉风景${index + 1}.jpg`,
    imageinfo: [{
      thumburl: `https://upload.wikimedia.org/photo-${index + 1}.jpg`,
      url: `https://upload.wikimedia.org/full-${index + 1}.jpg`,
      descriptionurl: `https://commons.wikimedia.org/wiki/File:武汉风景${index + 1}.jpg`,
      mime: "image/jpeg",
      extmetadata: {
        Artist: { value: `摄影师 ${index + 1}` },
        LicenseShortName: { value: "CC BY-SA 4.0" },
        LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0/" },
      },
    }],
  })) } });
  if (url.pathname === "/v3/geocode/geo") return Response.json({ status: "1", geocodes: [{ location: "114.30,30.50", formatted_address: "湖北省武汉市武昌站" }] });
  if (url.pathname === "/v3/place/text") return Response.json({ status: "1", pois: [{ id: "B001TEST", name: "武汉测试湖公园", type: "风景名胜;公园广场;公园", typecode: "110101", location: "114.40,30.60", pname: "湖北省", cityname: "武汉市", adname: "洪山区", address: "测试路", photos: [{ url: "http://store.is.autonavi.com/test.jpg" }, { url: "https://store.is.autonavi.com/test-2.jpg" }, { url: "https://store.is.autonavi.com/test-3.jpg" }] }] });
  if (url.pathname === "/v3/place/detail") return Response.json({ status: "1", pois: [{ id: "B001TEST", name: "武汉测试湖公园", typecode: "110101", location: "114.40,30.60", photos: [{ url: "https://store.is.autonavi.com/test.jpg" }, { url: "https://store.is.autonavi.com/door-sign.jpg" }, { url: "https://store.is.autonavi.com/detail-3.jpg" }, { url: "https://store.is.autonavi.com/detail-4.jpg" }, { url: "https://store.is.autonavi.com/detail-5.jpg" }] }] });
  if (url.pathname === "/v3/place/around") return Response.json({ status: "1", pois: [{ id: "NEAR1", name: "测试湖湿地", typecode: "110101", location: "114.401,30.601", photos: [{ url: "https://store.is.autonavi.com/near-1.jpg" }, { url: "https://store.is.autonavi.com/near-2.jpg" }] }, { id: "NEAR2", name: "测试湖绿道", typecode: "110101", location: "114.402,30.602", photos: [{ url: "https://store.is.autonavi.com/near-3.jpg" }, { url: "https://store.is.autonavi.com/near-4.jpg" }] }] });
  if (url.pathname === "/v3/direction/transit/integrated") return Response.json({ status: "1", route: { transits: [{ duration: "3600", cost: "5", walking_distance: "800", nightflag: "0", segments: [{ walking: { duration: "600", distance: "800", destination: "地铁站" }, bus: { buslines: [{ name: "轨道交通4号线(武汉火车站--柏林)", departure_stop: { name: "武昌火车站" }, arrival_stop: { name: "测试站" }, duration: "3000", via_num: "8" }] } }] }] } });
  throw new Error(`Unexpected URL ${url}`);
};

response = await worker.fetch(new Request("https://example.test/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image_data_url: "data:image/jpeg;base64,AA==" }) }), { ZHIPU_API_KEY: "test", ZHIPU_MODEL: "glm-4.6v" });
assert.equal(response.status, 200);
const vision = await response.json();
assert.deepEqual(vision.analysis.tags, ["水面", "树林"]);
assert.equal(zhipuBody.model, "glm-4.6v");
assert.equal(zhipuBody.messages[0].content[1].type, "image_url");
assert.equal(zhipuBody.messages[0].content[1].image_url.url, "AA==");
assert.equal(zhipuBody.thinking.type, "disabled");
assert.equal(vision.provider, "智谱");

response = await worker.fetch(new Request("https://example.test/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tags: ["水面", "树林"], limit: 18 }) }), { AMAP_API_KEY: "test", ZHIPU_API_KEY: "test" });
assert.equal(response.status, 200);
const discovery = await response.json();
assert.equal(discovery.provider, "高德地图");
assert.equal(discovery.places.length, 1);
assert.equal(discovery.places[0].id, "amap-B001TEST");
assert.equal(discovery.places[0].image_url, "https://store.is.autonavi.com/test.jpg");
assert.deepEqual(discovery.places[0].photo_urls, ["https://store.is.autonavi.com/test.jpg"]);
assert.equal(discovery.places[0].photo_details[0].provider, "高德地图");
assert.equal(discovery.places[0].tags.includes("水面"), true);
assert.equal(discovery.batch, 0);
assert.equal(discovery.next_batch, 1);
assert.equal(discovery.has_more, true);
assert.equal(photoFilterCalls, 0);

response = await worker.fetch(new Request("https://example.test/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tags: ["湿地", "水面"] }) }), {});
assert.equal(response.status, 200);
const openMapDiscovery = await response.json();
assert.equal(openMapDiscovery.provider, "OpenStreetMap");
assert.equal(openMapDiscovery.places[0].name, "测试湿地公园");
assert.equal(openMapDiscovery.places[0].network, true);

mapSearchKeywords.length = 0;
response = await worker.fetch(new Request("https://example.test/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "想找有芦苇的湿地湖岸，适合人像摄影", tags: ["建筑"] }) }), { AMAP_API_KEY: "test", ZHIPU_API_KEY: "test" });
assert.equal(response.status, 200);
const promptDiscovery = await response.json();
assert.deepEqual(promptDiscovery.interpretation.tags, ["湿地", "水面"]);
assert.equal(mapSearchKeywords.includes("芦苇"), true);
assert.equal(mapSearchKeywords.some(value => value.includes("古建筑")), false);
assert.equal(promptDiscovery.places.length, 1);
response = await worker.fetch(new Request("https://example.test/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tags: promptDiscovery.interpretation.tags, search_keywords: promptDiscovery.search_keywords, batch: promptDiscovery.next_batch, limit: 6 }) }), { AMAP_API_KEY: "test", ZHIPU_API_KEY: "test" });
assert.equal(response.status, 200);
const promptSecondBatch = await response.json();
assert.equal(promptSecondBatch.batch, 1);
assert.equal(mapSearchKeywords.includes("湖岸"), true);

for (const prompt of ["", " ", "a".repeat(601), { text: "湖岸" }]) {
  response = await worker.fetch(new Request("https://example.test/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt }) }), { AMAP_API_KEY: "test", ZHIPU_API_KEY: "test" });
  assert.equal(response.status, 422);
}
response = await worker.fetch(new Request("https://example.test/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "湖边草地" }) }), { AMAP_API_KEY: "test" });
assert.equal(response.status, 503);

response = await worker.fetch(new Request("https://example.test/api/photos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ poi_id: "B001TEST", name: "武汉测试湖公园" }) }), { AMAP_API_KEY: "test", ZHIPU_API_KEY: "test" });
assert.equal(response.status, 200);
const gallery = await response.json();
assert.equal(photoFilterCalls > 0, true);
assert.match(gallery.provider, /美篇/);
assert.equal(webSearchCalls, 2);
assert.equal(gallery.cover_url, "https://www.meipian.cn/panorama.jpg");
assert.equal(gallery.portrait_count, 2);
assert.equal(gallery.references.length, 1);
assert.equal(gallery.photos.some(photo=>photo.url.includes("127.0.0.1")), false);
assert.equal(gallery.photo_urls.length, 25);
assert.equal(gallery.photo_urls.includes("https://store.is.autonavi.com/door-sign.jpg"), false);
assert.equal(gallery.filtered_by, "智谱 GLM-4.6V");
assert.equal(gallery.scope, "地点及周边，逐张标注来源范围");
assert.equal(gallery.photos.length, 25);
const commonsPhoto = gallery.photos.find(photo => photo.provider === "Wikimedia Commons");
assert.equal(Boolean(commonsPhoto), true);
assert.equal(commonsPhoto.author.startsWith("摄影师"), true);
assert.equal(commonsPhoto.license, "CC BY-SA 4.0");
assert.match(commonsPhoto.source_url, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);

for (const [content, expectedStatus] of [[JSON.stringify({ tags: [], keywords: [], summary: "" }), 422], ["无法解析", 502]]) {
  globalThis.fetch = async (input) => {
    assert.equal(new URL(input).hostname, "open.bigmodel.cn");
    return Response.json({ choices: [{ finish_reason: "stop", message: { content } }] });
  };
  response = await worker.fetch(new Request("https://example.test/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "测试提示词" }) }), { AMAP_API_KEY: "test", ZHIPU_API_KEY: "test" });
  assert.equal(response.status, expectedStatus);
}

globalThis.fetch = async () => Response.json({ choices: [{ finish_reason: "stop", message: { content: "分析如下：\n```json\n{\"is_landscape\":\"true\",\"description\":\"湖泊、森林与木栈道\",\"tags\":\"湖泊、森林、木栈道\",\"season\":\"秋季\",\"light\":\"柔光\",\"confidence\":\"92%\"}\n```" } }] });
response = await worker.fetch(new Request("https://example.test/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image_data_url: "data:image/jpeg;base64,AA==" }) }), { ZHIPU_API_KEY: "test" });
assert.equal(response.status, 200);
const tolerantVision = await response.json();
assert.deepEqual(tolerantVision.analysis.tags, ["水面", "树林", "栈道"]);
assert.equal(tolerantVision.analysis.confidence, 0.92);

globalThis.fetch = async () => Response.json({ error: { message: "No credits", code: "1113" } }, { status: 429 });
response = await worker.fetch(new Request("https://example.test/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "湖边草地" }) }), { AMAP_API_KEY: "test", ZHIPU_API_KEY: "test" });
assert.equal(response.status, 402);
response = await worker.fetch(new Request("https://example.test/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image_data_url: "data:image/jpeg;base64,AA==" }) }), { ZHIPU_API_KEY: "test" });
assert.equal(response.status, 402);
assert.equal((await response.json()).error_code, "insufficient_quota");

for (const [payload, upstreamStatus, expectedStatus, expectedCode] of [
  [{ error: { code: "1302" } }, 429, 429, "rate_limit"],
  [{ error: { code: "1000" } }, 401, 502, "authentication"],
  [{ choices: [{ message: { content: "{}" } }] }, 200, 502, undefined],
  [{ choices: [{ finish_reason: "length", message: { content: "{}" } }] }, 200, 502, undefined],
]) {
  globalThis.fetch = async () => Response.json(payload, { status: upstreamStatus });
  response = await worker.fetch(new Request("https://example.test/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image_data_url: "data:image/jpeg;base64,AA==" }) }), { ZHIPU_API_KEY: "test" });
  assert.equal(response.status, expectedStatus);
  if (expectedCode) assert.equal((await response.json()).error_code, expectedCode);
}

globalThis.fetch = async (input) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  if (url.pathname === "/v3/geocode/geo") return Response.json({ status: "1", geocodes: [{ location: "114.30,30.50", formatted_address: "湖北省武汉市武昌站" }] });
  if (url.pathname === "/v3/place/text") return Response.json({ status: "1", pois: [{ name: url.searchParams.get("keywords"), location: "114.40,30.60", pname: "湖北省", cityname: "武汉市", adname: "洪山区", address: "测试路" }] });
  if (url.pathname === "/v3/direction/transit/integrated") return Response.json({ status: "1", route: { transits: [{ duration: "3600", cost: "5", walking_distance: "800", nightflag: "0", segments: [{ walking: { duration: "600", distance: "800", destination: "地铁站" }, bus: { buslines: [{ name: "轨道交通4号线(武汉火车站--柏林)", departure_stop: { name: "武昌火车站" }, arrival_stop: { name: "测试站" }, duration: "3000", via_num: "8" }] } }] }] } });
  if (url.pathname === "/v3/direction/driving") return Response.json({ status: "1", route: { paths: [{ duration: "1800", distance: "12000", tolls: "2", steps: [{ instruction: "沿中山路向北行驶", distance: "1200" }] }] } });
  if (url.pathname === "/v3/direction/walking") return Response.json({ status: "1", route: { paths: [{ duration: "5400", distance: "6000", steps: [{ instruction: "沿步道向北步行", distance: "600" }] }] } });
  if (url.pathname === "/v4/direction/bicycling") return Response.json({ errcode: 0, data: { paths: [{ duration: "2700", distance: "9000", steps: [{ instruction: "沿绿道骑行", distance: "900", duration: "270" }] }] } });
  throw new Error(`Unexpected URL ${url}`);
};
response = await worker.fetch(new Request("https://example.test/api/routes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ origin_address: "武汉市武昌区中山路武昌站", place_ids: ["luoyan", "jinyin", "moshan", "tingtao", "jiangtan", "jiufeng"], departure_at: "2026-09-14T00:00:00.000Z" }) }), { AMAP_API_KEY: "test" });
assert.equal(response.status, 200);
const routing = await response.json();
assert.equal(routing.results.length, 6);
assert.equal(routing.results.every(item => item.ok), true);
assert.equal(routing.results[0].duration_minutes, 60);
assert.equal(routing.results[0].cost_yuan, 5);
assert.equal(routing.results[0].walking_meters, 800);
assert.equal(routing.results[0].steps[1].mode, "地铁");

response = await worker.fetch(new Request("https://example.test/api/routes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ origin_address: "武汉市武昌区中山路武昌站", destinations: [{ id: "amap-B001TEST", name: "武汉测试湖公园", address: "武汉市洪山区测试路", location: "114.40,30.60" }], departure_at: "2026-09-14T00:00:00.000Z" }) }), { AMAP_API_KEY: "test" });
assert.equal(response.status, 200);
const dynamicRouting = await response.json();
assert.equal(dynamicRouting.results.length, 1);
assert.equal(dynamicRouting.results[0].id, "amap-B001TEST");
assert.equal(dynamicRouting.results[0].destination.name, "武汉测试湖公园");

for (const [mode, minutes] of [["transit", 60], ["driving", 30], ["walking", 90], ["bicycling", 45]]) {
  response = await worker.fetch(new Request("https://example.test/api/route", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ origin_address: "武汉市武昌区中山路武昌站", destination: { id: "amap-B001TEST", name: "武汉测试湖公园", address: "武汉市洪山区测试路", location: "114.40,30.60" }, departure_at: "2026-09-14T00:00:00.000Z", mode }) }), { AMAP_API_KEY: "test" });
  assert.equal(response.status, 200);
  const single = await response.json();
  assert.equal(single.route.mode, mode);
  assert.equal(single.route.duration_minutes, minutes);
  assert.equal(single.route.steps.length > 0, true);
}

globalThis.fetch = async input => {
  const url = new URL(typeof input === "string" ? input : input.url);
  assert.equal(url.hostname, "nominatim.openstreetmap.org");
  return Response.json([{ display_name: "武汉市武昌区中山路武昌站", lon: "114.316", lat: "30.528" }]);
};
response = await worker.fetch(new Request("https://example.test/api/routes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ origin_address: "武汉市武昌区中山路武昌站（开放地图测试）", destinations: [{ id: "osm-test", name: "武汉测试湖公园", address: "武汉市洪山区测试路", location: "114.40,30.60" }] }) }), {});
assert.equal(response.status, 200);
const basicRouting = await response.json();
assert.equal(basicRouting.provider, "开放地图基础估算");
assert.equal(basicRouting.results[0].ok, true);
assert.equal(basicRouting.results[0].duration_minutes > 0, true);
assert.equal(basicRouting.results[0].cost_yuan, null);

response = await worker.fetch(new Request("https://example.test/api/route", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ origin_address: "武汉市武昌区中山路武昌站（开放地图测试）", destination: { id: "osm-test", name: "武汉测试湖公园", address: "武汉市洪山区测试路", location: "114.40,30.60" }, mode: "walking" }) }), {});
assert.equal(response.status, 200);
const basicSingle = await response.json();
assert.equal(basicSingle.route.mode, "walking");
assert.equal(basicSingle.route.steps[0].mode, "步行");

globalThis.fetch = originalFetch;
console.log("Worker API tests passed");
