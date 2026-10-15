'use strict';

const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const photos = {
  lake: 'east-lake.jpeg',
  wetland: 'wetland.jpeg',
  forest: 'forest.jpg',
  luoyan: 'place-luoyan.jpg',
  jinyin: 'jinyin.jpg',
  moshan: 'place-moshan.jpg',
  tingtao: 'tingtao.png',
  jiangtan: 'place-jiangtan.jpg',
  jiufeng: 'place-jiufeng.jpg',
};
const features = ['水面', '树林', '栈道', '开阔视野', '草地', '山丘', '花卉', '湿地', '雪景', '沙滩', '建筑', '夜景', '云雾', '峡谷', '观鸟'];
const presets = {
  lake: { title: '湖岸与树林', photo: 'lake', tags: ['水面', '树林', '栈道'], copy: '平静水面、沿岸树林与木质栈道。寻找能重现这种安静氛围的地方。' },
  forest: { title: '林间小路', photo: 'forest', tags: ['树林', '山丘'], copy: '密集绿意与林间层次。以树林和山丘为主要特征，寻找相近氛围。' },
  river: { title: '开阔江滩', photo: 'wetland', tags: ['水面', '开阔视野', '草地', '湿地'], copy: '用湿地样片体验开阔水岸的筛选方向：水面、草地、湿地与远景。' },
};
const fallbackPlaces = [
  { id: 'luoyan', name: '东湖落雁景区', area: '洪山区 · 东湖东岸', photo: 'luoyan', actual: true, tags: ['水面', '树林', '栈道', '湿地'], reason: '湖岸杉林与九曲桥，把水面、树影和栈道放进同一个画面。', season: '杉林颜色随季节变化；九曲桥水雾开放时段需现场核实。', source: 'https://www.whdonghu.gov.cn/xwzx_6309/dhyw/202207/t20220701_1997987.shtml' },
  { id: 'jinyin', name: '金银湖国家城市湿地公园', area: '东西湖区 · 金银湖', photo: 'jinyin', actual: true, tags: ['水面', '栈道', '开阔视野', '草地', '湿地', '观鸟'], reason: '栈道穿过浅水与水生植物，适合拍水岸层次和开阔的天空。', season: '荷花、睡莲与水草有季节变化，湿地水位也会改变观感。', source: 'https://m.cnhubei.com/content/2022-05/08/content_14729944.html' },
  { id: 'moshan', name: '东湖磨山景区', area: '洪山区 · 东湖磨山', photo: 'moshan', actual: true, tags: ['树林', '山丘', '花卉', '水面'], reason: '山丘、林间步道与季节花卉形成前后景，适合寻找层层绿意。', season: '照片展示磨山杜鹃花景；樱花、梅花和杜鹃各有花期。', source: 'https://www.wuhan.gov.cn/sy/whyw/202404/t20240409_2386348.shtml' },
  { id: 'tingtao', name: '东湖听涛景区', area: '武昌区 · 东湖西岸', photo: 'tingtao', actual: true, tags: ['水面', '树林', '开阔视野'], reason: '湖畔步道与树荫兼具，适合把近处树枝和远处湖面一起取景。', season: '照片展示听涛景区湖岸慢游步道；树色和水位会随季节变化。', source: 'https://3g.wuhan.gov.cn/sy/whyw/202209/t20220912_2039056.shtml' },
  { id: 'jiangtan', name: '汉口江滩', area: '江岸区 · 沿江大道', photo: 'jiangtan', actual: true, tags: ['水面', '开阔视野', '草地', '夜景'], reason: '江面和大尺度岸线适合开阔构图，植被景观随季节变化。', season: '照片展示汉口江滩与长江城市天际线；江滩水位和岸线景观会随季节变化。', source: 'https://hbj.wuhan.gov.cn/hjsj/ztzl/mryt/2025mryt/202509/t20250929_2654532.html' },
  { id: 'jiufeng', name: '九峰国家森林公园', area: '洪山区 · 九峰', photo: 'jiufeng', actual: true, tags: ['树林', '山丘', '观鸟'], reason: '连续林地与山间步道更接近森林氛围，适合把绿意作为画面主体。', season: '照片展示九峰国家森林公园入口及后方山林；园内步行量较大。', source: 'https://www.wehdz.gov.cn/2022/mlgg/202302/t20230222_2157072.shtml' },
];
const builtins = [
  { id: 'wuchang', name: '武昌站', address: '武汉市武昌区中山路武昌站' },
  { id: 'hankou', name: '汉口站', address: '武汉市江汉区发展大道汉口站' },
  { id: 'guanggu', name: '光谷广场', address: '武汉市洪山区珞喻路光谷广场' },
];

function readStorage() {
  try {
    const value = JSON.parse(localStorage.getItem('jingqu-origins-v2') || localStorage.getItem('jingqu-origins-v1'));
    if (value && Array.isArray(value.custom)) return {
      custom: value.custom.filter(item => item && typeof item.id === 'string' && item.id.startsWith('custom-') && typeof item.name === 'string' && typeof item.address === 'string').slice(0, 20).map(item => ({ id: item.id, name: item.name.slice(0, 30), address: item.address.slice(0, 120) })),
      defaultId: typeof value.defaultId === 'string' ? value.defaultId : 'wuchang',
    };
  } catch {}
  return { custom: [], defaultId: 'wuchang' };
}

const saved = readStorage();
let origins = [...builtins, ...saved.custom];
let defaultId = origins.some(item => item.id === saved.defaultId) ? saved.defaultId : 'wuchang';
let originId = defaultId;
let tags = new Set();
let sort = 'balanced';
let comparison = new Set();
let selected = null;
let customPhoto = false;
let imageData = null;
let busy = false;
let toastTimer;
let services = { vision: true, remoteVision: false, search: true, transit: true, realtimeTransit: false, checked: false };
let liveRoutes = new Map();
let routeModeCache = new Map();
let routeQueriedAt = null;
let routeProvider = '';
let analysis = null;
let places = [];
let discoveryProvider = '';
let discovering = false;
let loadingMore = false;
let searchSequence = 0;
let routeRequestSequence = 0;
let galleryRequestSequence = 0;
let galleryState = null;
let tagSearchTimer;

function saveOrigins() {
  try { localStorage.setItem('jingqu-origins-v2', JSON.stringify({ custom: origins.filter(item => !builtins.some(base => base.id === item.id)), defaultId })); return true; }
  catch { notify('浏览器无法保存偏好，本次仍可使用。'); return false; }
}
function origin() { return origins.find(item => item.id === originId) || builtins[0]; }
function place(id) { return places.find(item => item.id === id); }
function notify(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3800); }
function similarity(item) { if (!tags.size) return 0; const matched = [...tags].filter(tag => item.tags.includes(tag)).length; return Math.round(100 * (0.85 * matched / tags.size + 0.15 * matched / item.tags.length)); }
function metrics(item) { const route = liveRoutes.get(item.id); return { time: route?.ok ? route.duration_minutes : null, fare: route?.ok && Number.isFinite(route.cost_yuan) ? route.cost_yuan : null, transfers: route?.ok ? route.transfers : null, walking: route?.ok ? route.walking_meters : null, similarity: similarity(item), route }; }
function score(item) { const value = metrics(item); if (sort === 'similarity') return value.similarity; if (sort === 'time') return value.time === null ? -Infinity : -value.time; if (sort === 'cost') return value.fare === null ? -Infinity : -value.fare; if (value.time === null) return value.similarity * 0.6; const fare = value.fare ?? 20; return 0.6 * value.similarity + 0.25 * Math.max(0, 100 * (1 - value.time / 180)) + 0.15 * Math.max(0, 100 * (1 - fare / 20)); }
function ranked() { const maxTime = Number($('#time-limit').value), maxFare = Number($('#cost-limit').value); return places.filter(item => { const value = metrics(item); return tags.size && value.similarity > 0 && (value.time === null ? maxTime === 999 : value.time <= maxTime) && (value.fare === null ? maxFare === 999 : value.fare <= maxFare); }).sort((a, b) => score(b) - score(a) || similarity(b) - similarity(a) || a.id.localeCompare(b.id)); }
function routeModes(route) { return route?.ok ? ([...new Set(route.steps.map(step => step.mode))].join(' → ') || '公共交通') : ''; }
function freshnessText() { return loadingMore ? '联网服务 · 继续加载中' : routeQueriedAt ? `${routeProvider} · ${new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(routeQueriedAt))} 查询` : discoveryProvider ? `${discoveryProvider} · 已联网搜景` : '尚未联网搜索'; }
function fallbackImage(item) {
  if (item.photo && photos[item.photo]) return photos[item.photo];
  if (item.tags.includes('湿地') || item.tags.includes('水面')) return photos.wetland;
  if (item.tags.includes('树林') || item.tags.includes('山丘')) return photos.forest;
  return photos.lake;
}
function imageFor(item) { return item.image_url || fallbackImage(item); }
function photoCaption(item) { if (item.photos_loaded) { const detail = galleryPhotoDetail(item, item.image_url); return detail ? `${detail.scope?.startsWith('周边') ? '周边参考' : '精选实拍'} · ${detail.provider}` : '暂无合格照片'; } if (item.photo_loading) return '正在多源搜图与筛选…'; if (item.photo_error) return '搜图暂不可用 · 点击重试'; if (item.network && item.image_url) return '地图原图 · 待筛选'; if (item.actual) return '地点实景 · 来源见详情'; return '暂无地点图片'; }
function galleryPhotos(item) {
  if (item.photos_loaded) return item.photo_urls || [];
  if (item.network) return [];
  const remote = [...new Set([...(Array.isArray(item.photo_urls) ? item.photo_urls : []), item.image_url].filter(value => typeof value === 'string' && /^https?:\/\//i.test(value)))];
  if (remote.length) return remote;
  return item.network ? [] : [fallbackImage(item)];
}
function galleryPhotoDetail(item, url) {
  const detail = Array.isArray(item.photo_details) ? item.photo_details.find(photo => photo?.url === url) : null;
  return detail || (item.network ? { provider: '高德地图', source_url: amapPlaceUrl(item), title: item.name, author: '', license: '', license_url: '' } : null);
}

function portraitReferences(item) {
  const location = item.name.includes('武汉') ? item.name : `武汉 ${item.name}`;
  const searches = [['人像摄影', '人像摄影'], ['写真与构图', '写真'], ['拍照机位', '人像 拍照机位']];
  return `<section class="portrait-references" aria-label="小红书人像参考"><div class="portrait-heading"><strong>小红书 · 人像参考</strong><span>选择打开方式</span></div><p>寻找${esc(item.name)}的人像实拍、构图与机位。</p><div class="portrait-searches">${searches.map(([label, keywords]) => {
    const query = `${location} ${keywords}`, encoded = encodeURIComponent(query);
    return `<div class="portrait-search"><strong>${label}</strong><input class="portrait-keyword" readonly aria-label="${label}搜索关键词" value="${esc(query)}"><div class="portrait-search-actions"><a data-open-portrait-app href="xhsdiscover://search/result?keyword=${encoded}&amp;target_search=notes&amp;source=deeplink">复制并打开 App</a><a class="portrait-web-search" href="https://www.xiaohongshu.com/search_result?keyword=${encoded}&amp;source=web_explore_feed" target="_blank" rel="noopener noreferrer">网页版 ↗</a><button type="button" data-copy-portrait>复制关键词</button></div><p class="portrait-launch-status" role="status" hidden></p><div class="portrait-app-fallback" hidden><a data-open-portrait-app href="xhsdiscover://home/explore">打开首页再搜索 ↗</a><span>如果没有跳转，请在 Safari 或系统浏览器中打开景去，再点一次。</span></div></div>`;
  }).join('')}</div><small>手机请选择「复制并打开 App」。若未进入搜索，可打开小红书首页并粘贴关键词。手机网页版不支持此搜索页面；电脑网页版需登录，且可能受小红书的网络安全限制。</small></section>`;
}

function renderTags() {
  $('#feature-tags').innerHTML = features.map(tag => `<button class="${tags.has(tag) ? 'active' : ''}" data-tag="${tag}" aria-pressed="${tags.has(tag)}" ${busy ? 'disabled' : ''}>${tags.has(tag) ? '✓ ' : '+ '}${tag}</button>`).join('');
  $('#analyze').disabled = busy || !customPhoto;
  $('#generate-prompt').disabled = busy || !customPhoto;
  $('#search-prompt').disabled = busy || $('#scenery-prompt').value.trim().length < 2;
  $('#copy-prompt').disabled = busy || !$('#scenery-prompt').value.trim();
  $('#scenery-prompt').disabled = busy;
  $('#change-photo').disabled = busy;
  $('#replace-photo').disabled = busy;
}
function renderOrigin() { const item = origin(); $('#header-origin').textContent = `武汉 · ${item.name}`; $('#origin-name').textContent = item.name; $('#origin-address').textContent = item.address; }
function renderServiceStatus() {
  const status = $('#service-status'), badge = $('#service-badge');
  if (!services.checked) { status.textContent = '正在检查自动识图与公交服务…'; badge.textContent = '服务检测中'; badge.className = 'prototype'; return; }
  const ready = [services.remoteVision ? '模型识图' : '基础识图', services.search && '联网搜景', services.realtimeTransit ? '实时公交' : '路线估算'].filter(Boolean);
  status.textContent = services.realtimeTransit ? `${ready.join('、')}均可用。` : `基础服务可用：${ready.join('、')}；精确路线可在地图链接中查看。`;
  badge.textContent = '服务可用'; badge.className = 'prototype ready';
}
function renderResults() {
  if (discovering && !places.length) {
    $('#result-count').textContent = '…';
    $('#route-freshness').textContent = '联网服务 · 查询中';
    $('#ranking-caption').textContent = '正在根据景色标签搜索武汉地点';
    $('#results').innerHTML = '<div class="empty"><h3>正在联网查询地点…</h3><p>搜索武汉的湖泊、公园、湿地、山林与观景地点。</p></div>';
    renderCompareBar();
    return;
  }
  const list = ranked(); $('#result-count').textContent = list.length; $('#route-freshness').textContent = freshnessText();
  const captions = { balanced: '景色 60% · 时间 25% · 路费 15%', similarity: '优先与你选择的景色特征接近的地点', time: '按最近查询的单程耗时，从短到长', cost: '按最近查询的单程路费，从低到高' };
  $('#ranking-caption').textContent = loadingMore ? `已显示 ${list.length} 个，正在继续查找相似地点…` : routeQueriedAt ? captions[sort] : '先查询路线，再综合景色相似度、单程耗时与路费';
  const cards = list.length ? list.map((item, index) => {
    const value = metrics(item); const pending = Boolean(value.route?.pending); const state = value.route?.ok ? `${routeModes(value.route)} · 步行 ${value.walking || 0} 米` : value.route ? value.route.error : '待查询实时公交';
    const itemId = esc(item.id), fallback = esc(fallbackImage(item));
    const visual = (item.photos_loaded && item.image_url) || !item.network ? `<img src="${esc(imageFor(item))}" data-fallback="${fallback}" alt="${esc(item.name)}景观照片" loading="lazy" referrerpolicy="no-referrer">` : `<span class="no-landscape-photo"><strong>${item.photo_loading ? '正在寻找代表性照片' : item.photos_loaded ? '暂无合格照片' : '点击寻找风景与人像'}</strong><small>点击查找拍摄思路</small></span>`;
    return `<article class="place-card" data-place="${itemId}"><button type="button" class="place-image" data-gallery="${itemId}" aria-label="查看${esc(item.name)}的拍摄思路">${visual}<span class="rank-badge ${index === 0 ? 'first' : ''}">${index === 0 ? '首选推荐' : '备选 ' + (index + 1)}</span><span class="gallery-hint">查看更多拍摄思路</span><span class="photo-caption">${esc(photoCaption(item))}</span></button><div class="place-content"><button type="button" class="place-route-area" data-route="${itemId}" aria-label="查看${esc(item.name)}的路线"><div class="place-top"><div><h3>${esc(item.name)}</h3><span class="location">${esc(item.area)}</span></div><div class="score"><strong>${value.similarity}<small>%</small></strong><small>照片特征匹配</small></div></div><p class="reason">${esc(item.reason)}</p><div class="metrics ${pending ? 'metrics-loading' : ''}"><div class="metric"><strong>${pending ? '查询中' : value.time === null ? '待查询' : value.time}<small>${value.time === null ? '' : '分钟'}</small></strong><span>单程约</span></div><div class="metric"><strong>${pending ? '查询中' : value.route?.ok ? (value.fare === null ? '未返回' : '¥' + value.fare) : '待查询'}</strong><span>单程路费约</span></div><div class="metric"><strong>${pending ? '…' : value.transfers === null ? '—' : value.transfers}<small>${value.transfers === null ? '' : '次'}</small></strong><span>换乘</span></div></div><div class="route-summary ${value.route && !value.route.ok && !pending ? 'route-error' : ''}">${esc(state)}</div></button><div class="card-actions"><label class="compare-label"><input type="checkbox" data-compare="${itemId}" ${comparison.has(item.id) ? 'checked' : ''}>加入比较</label><button class="route-button" data-route="${itemId}">查看路线 ↗</button></div></div></article>`;
  }).join('') : `<div class="empty"><h3>${tags.size ? '暂时没有符合条件的地点' : '请先上传一张风景照片'}</h3><p>${tags.size ? '放宽时间或路费限制，看看更多相似风景。' : '照片上传后会自动识别景色，并寻找武汉的相似地点。'}</p><button class="primary" id="${tags.size ? 'reset-filters' : 'upload-empty'}">${tags.size ? '清除筛选条件' : '上传照片'}</button></div>`;
  const progress = loadingMore ? '<div class="progressive-loading" role="status"><span></span><div><strong>更多地点正在载入</strong><small>首批结果已经可以查看，后续候选会自动追加。</small></div></div>' : '';
  $('#results').innerHTML = cards + progress;
  observePhotoCards();
  renderCompareBar();
}
function renderCompareBar() { $('#compare-bar').hidden = comparison.size === 0; $('#compare-count').textContent = `已选 ${comparison.size} / 3 个地点`; $('#show-compare').disabled = comparison.size < 2; }
function render() { renderOrigin(); renderServiceStatus(); renderTags(); renderResults(); }
function selectSourceTab(mode, focus = false) {
  const selectedMode = mode === 'prompt' ? 'prompt' : 'photo';
  document.querySelectorAll('[data-source-tab]').forEach(button => {
    const active = button.dataset.sourceTab === selectedMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    if (active && focus) button.focus();
  });
  document.querySelectorAll('[data-source-panel]').forEach(panel => { panel.hidden = panel.dataset.sourcePanel !== selectedMode; });
  $('#feature-tags-hint').textContent = selectedMode === 'photo' ? '上传后自动识别景色；你也可以增减标签，再刷新推荐。' : '搜索后会提取景色标签；你也可以增减标签，再刷新推荐。';
}
function showModal(title, html, owner = 'generic') { if (owner !== 'gallery') { galleryRequestSequence += 1; galleryState = null; } $('#modal-title').textContent = title; $('#modal-content').innerHTML = html; if (!$('#modal').open) $('#modal').showModal(); }

const photoLoads = new Map();
const photoQueue = [];
let activePhotoLoads = 0;
const photoObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) {
    photoObserver.unobserve(entry.target);
    const item = place(entry.target.dataset.place);
    if (item && !item.photos_loaded && !item.photo_error) void loadPlacePhotos(item).catch(() => {});
  }
}, { rootMargin: '100px' }) : null;
function observePhotoCards() {
  photoObserver?.disconnect();
  if (!services.remoteVision || !services.realtimeTransit) return;
  document.querySelectorAll('.place-card').forEach(card => { const item = place(card.dataset.place); if (item && !item.photos_loaded && !item.photo_loading && !item.photo_error) photoObserver?.observe(card); });
}
function pumpPhotoQueue() {
  while (activePhotoLoads < 2 && photoQueue.length) {
    const job = photoQueue.shift();
    if (!places.includes(job.item)) { photoLoads.delete(job.item); job.item.photo_loading = false; job.resolve(); continue; }
    activePhotoLoads += 1;
    api('/api/photos', { poi_id: job.item.poi_id || '', name: job.item.name }).then(result => {
      const item = job.item;
      item.photo_details = Array.isArray(result.photos) ? result.photos.filter(photo => /^https:\/\//i.test(photo.url)) : [];
      item.photo_urls = item.photo_details.map(photo => photo.url);
      item.image_url = item.photo_urls.includes(result.cover_url) ? result.cover_url : item.photo_urls[0] || '';
      item.photo_references = result.references || [];
      item.web_search_available = result.web_search_available;
      item.photos_loaded = true;
      item.photo_error = '';
      job.resolve();
    }).catch(error => { job.item.photo_error = error.message || '照片搜索暂不可用'; job.reject(error); }).finally(() => {
      activePhotoLoads -= 1; photoLoads.delete(job.item); job.item.photo_loading = false;
      if (places.includes(job.item)) renderResults();
      if (galleryState?.item === job.item && $('#modal').open) { galleryState.photos = galleryPhotos(job.item); renderGallery(); }
      pumpPhotoQueue();
    });
  }
}
function loadPlacePhotos(item, priority = false) {
  if (item.photos_loaded) return Promise.resolve();
  if (photoLoads.has(item)) return photoLoads.get(item);
  item.photo_loading = true; item.photo_error = '';
  const promise = new Promise((resolve, reject) => { const job = { item, resolve, reject }; priority ? photoQueue.unshift(job) : photoQueue.push(job); });
  photoLoads.set(item, promise); pumpPhotoQueue();
  return promise;
}
function renderGallery() {
  if (!galleryState) return;
  const { item } = galleryState;
  const all = galleryState.photos;
  const filter = galleryState.filter || 'all';
  const images = all.filter(url => filter === 'all' || galleryPhotoDetail(item, url)?.kind === filter);
  const portraits = all.filter(url => galleryPhotoDetail(item, url)?.kind === 'portrait').length;
  const tabs = `<div class="gallery-filters" role="group" aria-label="照片类型">${[['all', `全部 ${all.length}`], ['landscape', `风景 ${all.length - portraits}`], ['portrait', `环境人像 ${portraits}`]].map(([key, label]) => `<button type="button" data-photo-filter="${key}" aria-pressed="${filter === key}">${label}</button>`).join('')}</div>`;
  const references = (item.photo_references || []).filter(ref => /^https:\/\//i.test(ref.url)).map(ref => `<a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">${esc(ref.title)} · ${esc(ref.provider)} ↗</a>`).join('');
  const sourceLinks = `${references ? `<section class="photo-source-links"><strong>更多原站拍摄参考</strong>${references}</section>` : ''}${portraitReferences(item)}`;
  let content;
  if (!images.length) {
    const message = item.photo_loading ? '正在多源搜索并筛选照片…' : item.photo_error || (filter === 'portrait' ? '暂未找到合格的当地环境人像照' : '暂未找到合格照片');
    content = `<div class="gallery-empty" role="status"><span>▧</span><strong>${esc(message)}</strong><p>保留能看清环境的风景和人像，排除门牌、店招与纯自拍。不足时不以其他地点图片补齐。</p>${item.photo_error ? '<button class="primary" data-retry-photos>重新搜图</button>' : ''}</div>`;
  } else {
    galleryState.index = ((galleryState.index % images.length) + images.length) % images.length;
    const index = galleryState.index, detail = galleryPhotoDetail(item, images[index]);
    const thumbs = `<div class="gallery-thumbs" aria-label="选择照片">${images.map((url, i) => `<button type="button" class="${i === index ? 'active' : ''}" data-gallery-index="${i}" aria-label="查看第 ${i + 1} 张照片" aria-current="${i === index}"><img src="${esc(url)}" data-gallery-photo alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join('')}</div>`;
    const navigation = images.length > 1 ? '<button type="button" class="gallery-nav previous" data-gallery-nav="-1" aria-label="上一张照片">‹</button><button type="button" class="gallery-nav next" data-gallery-nav="1" aria-label="下一张照片">›</button>' : '';
    content = `<div class="photo-gallery"><div class="gallery-stage"><img src="${esc(images[index])}" data-gallery-photo alt="${esc(item.name)}${detail?.kind === 'portrait' ? '环境人像' : '风景'}，第 ${index + 1} 张" referrerpolicy="no-referrer">${navigation}<span class="gallery-counter">${index + 1} / ${images.length}</span></div>${thumbs}<div class="gallery-meta"><p><strong>${esc(detail?.composition || '地点拍摄参考')}</strong><small>${esc(detail?.scope || '来源见原文')} · 地点依据来源说明，视觉筛选不等于地理核验</small><small class="gallery-credit">来源：${detail?.source_url ? `<a href="${esc(detail.source_url)}" target="_blank" rel="noopener noreferrer">${esc(detail.provider)} ↗</a>` : '地点原文'}${detail?.author ? ` · ${esc(detail.author)}` : ''} ${detail?.license_url ? `<a href="${esc(detail.license_url)}" target="_blank" rel="noopener noreferrer">${esc(detail.license)}</a>` : esc(detail?.license || '')}</small><small>拍摄时间、季节与现场景观可能不同。</small></p></div></div>`;
  }
  const status = item.photos_loaded ? `<p class="photo-search-summary">已筛选 ${all.length} 张，含 ${portraits} 张环境人像。${portraits ? '可切换上方分类查看人像构图。' : '公开来源暂未找到合格人像，可查看下方原站参考。'}${item.web_search_available === false ? ' 网页搜索暂不可用，本次使用地图与开放图库。' : ''}</p>` : '';
  showModal(`${item.name} · 拍摄思路`, `${tabs}${status}${content}${sourceLinks}`, 'gallery');
}
async function openGallery(id) {
  const item = place(id); if (!item) return;
  ++galleryRequestSequence;
  galleryState = { item, photos: galleryPhotos(item), index: 0, filter: 'all' };
  if (!item.photos_loaded && services.realtimeTransit && services.remoteVision) void loadPlacePhotos(item, true).catch(() => {});
  renderGallery();
}

async function queryRoutesFor(items, sequence) {
  if (!items.length) return 0;
  routeModeCache.clear();
  for (const item of items) liveRoutes.set(item.id, { id: item.id, ok: false, pending: true, error: '正在查询公交…' });
  renderResults();
  const results = await Promise.all(items.map(async item => {
    try {
      const result = await api('/api/route', {
        origin_address: origin().address,
        place_id: item.id,
        destination: item.location ? { id: item.id, name: item.name, address: item.address || item.area, location: item.location } : null,
        departure_at: departureISO(),
        mode: 'transit',
      });
      if (sequence !== searchSequence) return false;
      const route = { ...result.route, origin: result.origin, queried_at: result.queried_at, provider: result.provider };
      liveRoutes.set(item.id, route);
      routeModeCache.set(routeCacheKey(item.id, 'transit'), route);
      routeQueriedAt = result.queried_at;
      routeProvider = result.provider || '高德地图';
      renderResults();
      return true;
    } catch (error) {
      if (sequence !== searchSequence) return false;
      liveRoutes.set(item.id, { id: item.id, ok: false, error: error.message || '路线暂时不可用' });
      renderResults();
      return false;
    }
  }));
  return results.filter(Boolean).length;
}

async function loadRemainingPlaces(sequence, firstPage, { routes = false } = {}) {
  let page = firstPage;
  try {
    while (sequence === searchSequence && page.has_more && places.length < 18) {
      page = await api('/api/search', {
        tags: [...tags],
        search_keywords: firstPage.search_keywords || [],
        city: '武汉',
        batch: page.next_batch,
        limit: Math.min(6, 18 - places.length),
      });
      if (sequence !== searchSequence) return;
      const known = new Set(places.map(item => item.id));
      const added = (Array.isArray(page.places) ? page.places : []).filter(item => !known.has(item.id)).slice(0, 18 - places.length);
      if (added.length) {
        places.push(...added);
        renderResults();
        if (routes) {
          try { await queryRoutesFor(added, sequence); }
          catch (error) { if (sequence === searchSequence) console.error('Progressive route query failed', error); }
        }
      }
    }
  } catch (error) {
    if (sequence === searchSequence && places.length) notify(`已先显示 ${places.length} 个地点，更多地点暂未加载：${error.message}`);
  } finally {
    if (sequence === searchSequence) { loadingMore = false; renderResults(); }
  }
}

async function discoverPlaces({ announce = false, prompt = '', progressiveRoutes = false } = {}) {
  if (!tags.size && !prompt) return null;
  const sequence = ++searchSequence;
  discovering = true;
  loadingMore = false;
  places = [];
  comparison.clear();
  liveRoutes.clear();
  routeModeCache.clear();
  routeQueriedAt = null;
  renderResults();
  try {
    const discovery = await api('/api/search', { tags: [...tags], ...(prompt ? { prompt } : {}), city: '武汉', batch: 0, limit: 6 });
    if (sequence !== searchSequence) return null;
    if (discovery.interpretation) {
      tags = new Set(discovery.interpretation.tags);
      $('#analysis-label').textContent = '提示词特征';
      $('#analysis-copy').textContent = discovery.interpretation.summary;
      $('#prompt-status').textContent = `已理解：${discovery.interpretation.tags.join('、')}。按这些景观特征寻找相似地点。`;
      renderTags();
    }
    places = discovery.places;
    discoveryProvider = discovery.provider || '高德地图';
    discovering = false;
    loadingMore = Boolean(discovery.has_more && places.length < 18);
    renderResults();
    if (announce) notify(`首批已找到 ${places.length} 处相似景色，更多地点正在加载。`);
    const initialPlaces = places.slice();
    const continuation = loadingMore ? loadRemainingPlaces(sequence, discovery, { routes: progressiveRoutes }) : Promise.resolve();
    return { ok: true, sequence, initialPlaces, continuation };
  } catch (error) {
    if (sequence !== searchSequence) return null;
    if (prompt) {
      places = []; discoveryProvider = ''; liveRoutes.clear(); routeModeCache.clear(); routeQueriedAt = null;
      throw error;
    }
    places = fallbackPlaces.slice();
    discoveryProvider = '本地候选';
    liveRoutes.clear();
    routeModeCache.clear();
    routeQueriedAt = null;
    if (announce) notify(`联网搜景暂时失败，先显示 6 个精选地点：${error.message}`);
    return { ok: false, sequence, initialPlaces: places.slice(), continuation: Promise.resolve() };
  } finally {
    if (sequence === searchSequence && discovering) { discovering = false; loadingMore = false; renderResults(); }
  }
}

function scheduleDiscovery() {
  clearTimeout(tagSearchTimer);
  tagSearchTimer = setTimeout(() => discoverPlaces({ announce: true }), 450);
}

function usePreset(key) {
  const item = presets[key]; if (!item) return; searchSequence += 1; routeRequestSequence += 1; clearTimeout(tagSearchTimer); discovering = false; loadingMore = false; customPhoto = false; imageData = null; analysis = null; tags = new Set(item.tags); places = fallbackPlaces.slice(); discoveryProvider = ''; liveRoutes.clear(); routeModeCache.clear(); routeQueriedAt = null;
  $('#source-image').src = photos[item.photo]; $('#source-image').alt = key === 'river' ? '金银湖湿地参考照片' : `${item.title}参考照片`; $('#photo-label').textContent = `灵感样片 · ${item.title}`; $('#analysis-label').textContent = '样片特征'; $('#analysis-copy').textContent = item.copy; $('#analyze').innerHTML = '联网找景并估算路线 <span>↗</span>';
  writeSceneryPrompt(item.copy, item.tags);
  document.querySelectorAll('[data-preset]').forEach(button => button.classList.toggle('active', button.dataset.preset === key)); comparison.clear(); render();
}
async function compressPhoto(file) {
  const url = URL.createObjectURL(file), image = new Image(); image.src = url;
  try { await image.decode(); } catch { URL.revokeObjectURL(url); throw new Error('无法读取这张照片，请换一张再试。'); }
  const scale = Math.min(1, 1440 / Math.max(image.naturalWidth, image.naturalHeight)), canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { alpha: false }); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url); return canvas.toDataURL('image/jpeg', 0.82);
}
async function analyzePhotoLocally(dataUrl) {
  const image = new Image(); image.src = dataUrl; await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('当前浏览器无法分析照片，请改用景色描述。');
  context.drawImage(image, 0, 0, 64, 64);
  const pixels = context.getImageData(0, 0, 64, 64).data;
  let green = 0, blue = 0, bright = 0, dark = 0, warm = 0, total = 0, upperBright = 0;
  for (let index = 0; index < pixels.length; index += 16) {
    const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2], light = (r + g + b) / 3; total += 1;
    if (g > r * 1.08 && g > b * .92 && g > 55) green += 1;
    if (b > r * 1.08 && b > g * .9 && b > 70) blue += 1;
    if (light > 190) bright += 1; if (light < 62) dark += 1;
    if (r > 135 && r > g * 1.08 && g > b * .9) warm += 1;
    const pixelNumber = index / 4; if (pixelNumber < 64 * 24 && light > 150) upperBright += 1;
  }
  const ratios = { green: green / total, blue: blue / total, bright: bright / total, dark: dark / total, warm: warm / total, sky: upperBright / (total * 24 / 64) };
  const found = [];
  if (ratios.green > .16) found.push('树林');
  if (ratios.blue > .12) found.push('水面');
  if (ratios.sky > .34 || ratios.bright > .28) found.push('开阔视野');
  if (ratios.warm > .12 && ratios.green > .08) found.push('花卉');
  if (ratios.dark > .5) found.push('夜景');
  if (!found.length) found.push(ratios.green > .08 ? '树林' : '开阔视野');
  const unique = [...new Set(found)].slice(0, 4);
  const summary = `画面以${unique.join('、')}为主要视觉特征，适合据此寻找武汉的相似拍摄环境。`;
  return { is_landscape: true, summary, tags: unique, season: '基础识图无法可靠判断季节', light: ratios.dark > .5 ? '整体光线较暗' : ratios.bright > .3 ? '整体光线明亮' : '明暗较均衡', confidence: .62, caution: '这是浏览器本机完成的基础色彩识别，请按画面内容增减标签。' };
}
async function analyzeCurrentPhoto() {
  if (!imageData) throw new Error('请先上传一张照片。');
  if (services.remoteVision) {
    try { return (await api('/api/analyze', { image_data_url: imageData })).analysis; }
    catch (error) { notify(`模型识图暂时不可用，已改用本机基础识图：${error.message}`); }
  }
  return await analyzePhotoLocally(imageData);
}
async function upload(file) {
  if (busy) return;
  if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { notify('请使用 JPG、PNG 或 WebP 图片。'); return; } if (file.size > 10 * 1024 * 1024) { notify('照片超过 10 MB，请压缩后再试。'); return; }
  const previousImageData = imageData;
  busy = true; renderTags(); $('#analysis-copy').textContent = '正在本机压缩照片并移除拍摄信息…';
  try { imageData = await compressPhoto(file); searchSequence += 1; clearTimeout(tagSearchTimer); discovering = false; loadingMore = false; customPhoto = true; tags = new Set(); analysis = null; places = []; discoveryProvider = ''; $('#source-image').src = imageData; $('#source-image').hidden = false; $('#photo-empty').hidden = true; $('#photo-bottom').hidden = false; $('#dropzone').classList.add('has-photo'); $('#photo-label').textContent = file.name; $('#analysis-label').textContent = '待自动识别'; $('#analysis-copy').textContent = '照片已在本机压缩并移除 EXIF。点击下方按钮后开始自动识图。'; $('#analyze').innerHTML = '自动识图、联网找景并查公交 <span>↗</span>'; liveRoutes.clear(); routeModeCache.clear(); routeQueriedAt = null; comparison.clear(); notify('照片已准备好，点击按钮开始识图。'); }
  catch (error) { notify(error.message || '照片处理失败，请换一张再试。'); }
  if (imageData !== previousImageData) { $('#scenery-prompt').value = ''; $('#prompt-status').textContent = '点击“从照片生成”，或直接写下想找的景色。'; }
  busy = false; render();
}
function writeSceneryPrompt(summary, photoTags) {
  $('#scenery-prompt').value = `在武汉寻找类似的拍摄地点：${summary}\n主要景观：${photoTags.join('、')}。`;
  $('#prompt-status').textContent = '提示词已生成，可以修改后找地点，也可以复制使用。';
}
function applyPhotoAnalysis(value) {
  if (!value.is_landscape || !value.tags?.length) throw new Error('照片中没有识别到可用于匹配的景观特征，请换一张或直接填写提示词。');
  analysis = value; tags = new Set(value.tags);
  $('#analysis-label').textContent = `模型置信 ${Math.round(value.confidence * 100)}%`;
  $('#analysis-copy').textContent = `${value.summary}${value.caution ? ` ${value.caution}` : ''}`;
  writeSceneryPrompt(value.summary, value.tags);
}
async function generateSceneryPrompt() {
  if (busy) return;
  busy = true; clearTimeout(tagSearchTimer); searchSequence += 1; discovering = false; loadingMore = false;
  $('#prompt-status').textContent = '正在根据照片生成提示词…'; renderTags();
  try {
    if (!customPhoto || !imageData) throw new Error('请先上传一张照片。');
    applyPhotoAnalysis(await analyzeCurrentPhoto());
  } catch (error) { $('#prompt-status').textContent = error.message || '生成失败，请重试或直接输入描述。'; }
  finally { busy = false; renderTags(); renderResults(); }
}
async function copySceneryPrompt() {
  const input = $('#scenery-prompt');
  if (!input.value.trim()) return;
  try { await navigator.clipboard.writeText(input.value); notify('提示词已复制。'); }
  catch { input.focus(); input.select(); notify('已选中提示词，请使用复制快捷键或长按复制。'); }
}
async function api(path, body) { const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); let data = {}; try { data = await response.json(); } catch {} if (!response.ok) throw new Error(data.error || '服务请求失败'); return data; }
function departureISO() { const value = $('#departure-time').value; if (!value) return new Date().toISOString(); const date = new Date(`${value}:00+08:00`); return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(); }
async function analyzeAndRoute({ fromPrompt = false } = {}) {
  const prompt = fromPrompt ? $('#scenery-prompt').value.trim() : '';
  if (fromPrompt && prompt.length < 2) { notify('请先填写找景提示词。'); return; }
  if (busy) return; busy = true; const button = $('#analyze'); renderTags();
  clearTimeout(tagSearchTimer); searchSequence += 1; discovering = false; loadingMore = false;
  try {
    if (customPhoto && !fromPrompt) { if (!imageData) throw new Error('请先选择一张照片。'); button.innerHTML = '正在识别照片…'; applyPhotoAnalysis(await analyzeCurrentPhoto()); renderResults(); }
    if (!tags.size && !prompt) throw new Error('请先选择至少一个景色特征。');
    if (fromPrompt) $('#prompt-status').textContent = '正在理解提示词并联网寻找相似地点…';
    button.innerHTML = '正在联网寻找更多景色…';
    const discovery = await discoverPlaces({ prompt, progressiveRoutes: services.transit });
    if (!discovery?.initialPlaces?.length) return;
    let success = 0;
    if (services.transit) { button.innerHTML = `正在计算首批 ${discovery.initialPlaces.length} 个地点的公交…`; success = await queryRoutesFor(discovery.initialPlaces, discovery.sequence); }
    notify(services.transit ? `首批 ${discovery.initialPlaces.length} 处景色已显示，并更新 ${success} 条路线估算；更多候选继续加载。` : `已联网找到首批 ${discovery.initialPlaces.length} 处相似景色。`);
    document.querySelector('.results-panel').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  } catch (error) { notify(error.message || '查询失败，请稍后重试。'); if (fromPrompt) $('#prompt-status').textContent = error.message; else if (customPhoto && !analysis) $('#analysis-copy').textContent = `识图失败：${error.message}`; }
  finally { busy = false; button.innerHTML = customPhoto ? '重新识图、找景并估算路线 <span>↗</span>' : '重新联网找景并估算路线 <span>↗</span>'; render(); }
}

function originDialog() { showModal('从哪里出发？', `<p class="dialog-description">默认出发点保存在当前浏览器。查询时，地址会发送给当前地图服务用于定位和路线估算。</p><div>${origins.map(item => `<div class="origin-option ${item.id === originId ? 'active' : ''}"><div><strong>${esc(item.name)}</strong> ${item.id === defaultId ? '<span class="pill">默认</span>' : ''}<small>${esc(item.address)}</small></div><div><button data-use-origin="${esc(item.id)}">${item.id === originId ? '正在使用' : '使用'}</button>${item.id !== defaultId ? `<button data-default-origin="${esc(item.id)}">设为默认</button>` : ''}</div></div>`).join('')}</div><form class="origin-form" id="origin-form"><h3>添加出发点</h3><label>名称<input name="name" placeholder="例如：家、公司" maxlength="30" required></label><label>完整地址<input name="address" placeholder="例如：武汉市武昌区中南路 18 号" maxlength="120" required></label><label class="check"><input type="checkbox" name="isDefault" checked>设为默认出发点</label><p class="tiny">地址只保存在当前浏览器；路线查询时会发送给当前地图服务。</p><button class="primary" type="submit">保存并使用</button></form>`); }
const transportModes = [
  { id: 'transit', label: '公交', icon: '▤' },
  { id: 'driving', label: '驾车', icon: '◇' },
  { id: 'walking', label: '步行', icon: '♙' },
  { id: 'bicycling', label: '骑行', icon: '○' },
];
function routeCacheKey(id, mode) { return `${id}:${mode}`; }
function distanceText(meters) { const value = Number(meters || 0); return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} 公里` : `${Math.round(value)} 米`; }
function amapPlaceUrl(item) { return `https://uri.amap.com/search?keyword=${encodeURIComponent(item.name)}&city=${encodeURIComponent('武汉')}&callnative=0`; }
function mapPlaceLinks(item, route, mode = 'transit') {
  const start = origin(), end = route?.destination || item;
  const startCoord = route?.origin?.location, endCoord = end.location;
  const latLng = value => value.split(',').reverse().join(',');
  const url = (base, params) => `${base}?${new URLSearchParams(params)}`;
  const modes = { transit: ['bus', 'transit', 'bus'], driving: ['car', 'driving', 'drive'], walking: ['walk', 'walking', 'walk'], bicycling: ['ride', 'riding', 'bike'] };
  const selectedMode = modes[mode] || modes.transit;
  const links = [
    ['高德地图', startCoord && endCoord ? url('https://uri.amap.com/navigation', { from: `${startCoord},${start.name}`, to: `${endCoord},${end.name}`, mode: selectedMode[0], coordinate: 'gaode', city: '武汉', callnative: '0' }) : null, 'amap'],
    ['百度地图', url('https://api.map.baidu.com/direction', { origin: startCoord ? `latlng:${latLng(startCoord)}|name:${start.name}` : start.address, destination: endCoord ? `latlng:${latLng(endCoord)}|name:${end.name}` : `${end.name} ${end.address || item.area}`, mode: selectedMode[1], region: '武汉', coord_type: 'gcj02', output: 'html', src: 'webapp.jingqu.scene_seeker' }), 'baidu'],
    ['腾讯地图', url('https://apis.map.qq.com/uri/v1/routeplan', { type: selectedMode[2], from: start.name, ...(startCoord ? { fromcoord: latLng(startCoord) } : { from: start.address }), to: end.name, ...(endCoord ? { tocoord: latLng(endCoord) } : {}), referer: 'jingqu' }), 'tencent'],
  ];
  return `<nav class="map-place-links" aria-label="在其他地图查看路线"><span>从${esc(start.name)}出发 · 选择地图查看路线</span>${links.map(([label, href, provider]) => href ? `<a class="map-link-${provider}" href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="在${label}查看从${esc(start.name)}到${esc(end.name)}的路线">${label} ↗</a>` : `<span>高德路线需查询成功后打开</span>`).join('')}</nav>`;
}
function modeTabs(item, mode, loading = false) { return `<div class="route-mode-tabs" role="tablist" aria-label="交通方式">${transportModes.map(option => `<button role="tab" aria-selected="${option.id === mode}" class="${option.id === mode ? 'active' : ''}" data-route-mode="${option.id}" data-place="${esc(item.id)}" ${loading ? 'disabled' : ''}><span>${option.icon}</span>${option.label}</button>`).join('')}</div>`; }
function routeHeader(item, route, mode, loading = false) {
  return `<div class="amap-route-head">${modeTabs(item, mode, loading)}<div class="route-endpoints"><div><i class="start-dot"></i><span>${esc(origin().name)}</span></div><div><i class="end-dot"></i><span>${esc(route?.destination?.name || item.name)}</span><small>${esc(route?.destination?.address || item.address || item.area || '')}</small></div></div></div>`;
}
function routePanel(item, route, mode) {
  const label = transportModes.find(option => option.id === mode)?.label || '路线';
  const distance = mode === 'transit' ? route.walking_meters : route.distance_meters;
  const middle = mode === 'transit'
    ? { value: Number.isFinite(route.cost_yuan) ? `¥${route.cost_yuan}` : '未返回', label: '公交费用约' }
    : mode === 'driving'
      ? { value: Number.isFinite(route.tolls_yuan) ? `¥${route.tolls_yuan}` : '—', label: '道路收费约' }
      : { value: '0 元', label: '路线费用' };
  const third = mode === 'transit' ? { value: distanceText(distance), label: '步行约' } : { value: distanceText(distance), label: '全程约' };
  const steps = route.steps?.length ? route.steps.map((step, index) => `<div class="route-step"><span class="step-index">${index + 1}</span><div><strong>${esc(step.mode)} · ${esc(step.title)}</strong><p>${step.from ? `${esc(step.from)} → ${esc(step.to || '')}<br>` : ''}${step.duration_minutes ? `约 ${step.duration_minutes} 分钟` : ''}${step.distance_meters ? `${step.duration_minutes ? ' · ' : ''}${distanceText(step.distance_meters)}` : ''}${step.via_stops ? ` · 途经 ${step.via_stops} 站` : ''}</p></div></div>`).join('') : '<p class="dialog-description">高德地图返回了总路线，但没有提供分段详情。</p>';
  const queried = route.queried_at || routeQueriedAt;
  const time = queried ? new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(queried)) : '刚刚';
  const provider = route.provider || routeProvider || '地图服务';
  const disclaimer = services.realtimeTransit ? '路线与费用为高德地图估算，实时路况、候车和运营调整可能改变结果。' : '当前为开放地图距离与常见速度估算；请点击下方地图链接查看实时路况、公交班次和精确导航。';
  return `${routeHeader(item, route, mode)}<div class="amap-live"><span></span>${esc(provider)} · ${time} 查询 · ${label}方案</div><div class="route-detail-meta"><div class="metric"><strong>${route.duration_minutes}<small>分钟</small></strong><span>预计单程</span></div><div class="metric"><strong>${middle.value}</strong><span>${middle.label}</span></div><div class="metric"><strong>${third.value}</strong><span>${third.label}</span></div></div><div class="route-timeline">${steps}</div><p class="route-disclaimer">${disclaimer}</p><p class="dialog-description"><strong>拍摄前留意</strong><br>${esc(item.season)}</p><div class="detail-footer">${mapPlaceLinks(item, route, mode)}<button class="primary" data-choose="${esc(item.id)}">选择这里</button></div>`;
}
async function routeDialog(id, mode = 'transit') {
  const item = place(id); if (!item) return;
  const requestSequence = ++routeRequestSequence;
  const key = routeCacheKey(id, mode);
  let route = routeModeCache.get(key) || (mode === 'transit' ? liveRoutes.get(id) : null);
  if (route?.ok) { showModal(item.name, `<div class="amap-route">${routePanel(item, route, mode)}</div>`); return; }
  showModal(item.name, `<div class="amap-route">${routeHeader(item, null, mode, true)}<div class="route-loading"><span></span><strong>正在查询${transportModes.find(option => option.id === mode)?.label}路线</strong><p>路线服务正在计算时间、距离和路线步骤…</p></div></div>`);
  try {
    const result = await api('/api/route', { origin_address: origin().address, place_id: item.id, destination: item.location ? { id: item.id, name: item.name, address: item.address || item.area, location: item.location } : null, departure_at: departureISO(), mode });
    route = { ...result.route, origin: result.origin, queried_at: result.queried_at, provider: result.provider };
    routeModeCache.set(key, route);
    if (requestSequence !== routeRequestSequence) return;
    showModal(item.name, `<div class="amap-route">${routePanel(item, route, mode)}</div>`);
  } catch (error) {
    if (requestSequence !== routeRequestSequence) return;
    showModal(item.name, `<div class="amap-route">${routeHeader(item, null, mode)}<div class="route-loading route-failed"><strong>未查到${transportModes.find(option => option.id === mode)?.label}路线</strong><p>${esc(error.message)}</p><button class="primary" data-route-mode="${mode}" data-place="${esc(item.id)}">重新查询</button></div><div class="detail-footer">${mapPlaceLinks(item, route, mode)}</div></div>`);
  }
}
function compareDialog() { const items = places.filter(item => comparison.has(item.id)).sort((a, b) => score(b) - score(a)); showModal('地点比较', `<p class="dialog-description">路线数据为 ${freshnessText()}；景色会随季节、天气和水位变化。</p><div class="comparison-scroll"><table class="comparison-table"><thead><tr><th>地点</th><th>匹配</th><th>单程时间</th><th>路费</th><th>换乘</th><th></th></tr></thead><tbody>${items.map(item => { const value = metrics(item); return `<tr><th>${esc(item.name)}</th><td>${value.similarity}%</td><td>${value.time === null ? '待查询' : value.time + ' 分钟'}</td><td>${value.fare === null ? '未返回' : '¥' + value.fare}</td><td>${value.transfers === null ? '—' : value.transfers + ' 次'}</td><td><button data-route="${esc(item.id)}">路线</button></td></tr>`; }).join('')}</tbody></table></div>`); }
function rankingDialog() { showModal('排序怎么来的？', `<div class="notes"><h3>景色匹配</h3><p>自动识图从照片可见内容提取标签，你也可以手动调整。地点卡片用标签重合度计算匹配值，不等于同一机位或同一季节。</p><h3>时间与路费</h3><p>查询时会用出发地址和候选地点计算路线。当前时间根据开放地图直线距离与常见速度估算；综合排序按景色 60%、单程时间 25%、单程路费 15% 计算，未知票价不参与费用判断。</p><h3>结果边界</h3><p>估算结果不含实时路况、候车与临时运营调整。请在路线详情中打开高德、百度或腾讯地图复核后再出发。</p></div>`); }
function notesDialog() { showModal('产品设计说明', `<div class="notes"><h3>完整流程</h3><p>上传照片后，本机压缩并移除 EXIF，再在浏览器内提取基础景色标签。开放地图返回武汉候选地，并提供基础距离与时间估算；路线详情支持公交、驾车、步行和骑行切换，也可跳转高德、百度或腾讯地图查看精确导航。</p><h3>隐私与数据</h3><p>本站不保存上传照片。自定义出发点只保存在当前浏览器；发起查询时，地址和景色关键词会发送给开放地图服务。</p><h3>如何选择</h3><p>先按照片特征寻找地点，再用耗时、费用、换乘和距离做决定。基础估算不包含实时路况和公交班次，请在出发前通过地图链接复核。</p></div>`); }
async function checkServices() { try { const response = await fetch('/api/status', { cache: 'no-store' }), value = await response.json(); services = { vision: true, remoteVision: Boolean(value.remote_vision), search: Boolean(value.search), transit: Boolean(value.routes ?? value.transit), realtimeTransit: Boolean(value.realtime_transit), checked: true }; } catch { services = { vision: true, remoteVision: false, search: true, transit: true, realtimeTransit: false, checked: true }; } renderServiceStatus(); }
function defaultDeparture() { const now = new Date(Date.now() + 15 * 60 * 1000); $('#departure-time').value = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(now).replace(' ', 'T'); }

document.querySelector('.source-tabs').addEventListener('click', event => { const tab = event.target.closest('[data-source-tab]'); if (tab) selectSourceTab(tab.dataset.sourceTab); });
document.querySelector('.source-tabs').addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); const tabs = [...document.querySelectorAll('[data-source-tab]')], current = tabs.indexOf(document.activeElement), offset = event.key === 'ArrowRight' ? 1 : -1, next = tabs[(current + offset + tabs.length) % tabs.length]; selectSourceTab(next.dataset.sourceTab, true); });
$('#change-photo').addEventListener('click', event => { event.stopPropagation(); $('#photo-file').click(); });
$('#replace-photo').addEventListener('click', event => { event.stopPropagation(); $('#photo-file').click(); });
$('#dropzone').addEventListener('click', event => { if (!event.target.closest('button')) $('#photo-file').click(); });
$('#photo-file').addEventListener('change', event => upload(event.target.files[0]));
for (const name of ['dragenter', 'dragover']) $('#dropzone').addEventListener(name, event => { event.preventDefault(); $('#dropzone').classList.add('dragging'); });
for (const name of ['dragleave', 'drop']) $('#dropzone').addEventListener(name, event => { event.preventDefault(); $('#dropzone').classList.remove('dragging'); });
$('#dropzone').addEventListener('drop', event => upload(event.dataTransfer.files[0]));
$('#generate-prompt').addEventListener('click', generateSceneryPrompt);
$('#copy-prompt').addEventListener('click', copySceneryPrompt);
$('#search-prompt').addEventListener('click', () => analyzeAndRoute({ fromPrompt: true }));
$('#scenery-prompt').addEventListener('input', () => { $('#prompt-status').textContent = '修改后点击“按提示词找地点”更新结果。'; renderTags(); });
$('#feature-tags').addEventListener('click', event => { const button = event.target.closest('[data-tag]'); if (!button) return; const tag = button.dataset.tag; tags.has(tag) ? tags.delete(tag) : tags.add(tag); renderTags(); renderResults(); scheduleDiscovery(); });
$('#analyze').addEventListener('click', analyzeAndRoute);
$('#results').addEventListener('error', event => {
  const image = event.target.closest('.place-image img'); if (!image) return;
  const item = place(image.closest('.place-card').dataset.place); if (!item) return;
  const failed = image.getAttribute('src');
  item.photo_urls = (item.photo_urls || []).filter(url => url !== failed);
  item.image_url = item.photo_urls[0] || '';
  if (!item.network) { image.remove(); return; }
  renderResults();
}, true);
$('#modal').addEventListener('error', event => {
  const image = event.target.closest('img[data-gallery-photo]');
  if (!image || !galleryState) return;
  const item = galleryState.item, failed = image.getAttribute('src');
  item.photo_urls = (item.photo_urls || []).filter(url => url !== failed);
  galleryState.photos = galleryState.photos.filter(url => url !== failed);
  if (item.image_url === failed) item.image_url = item.photo_urls[0] || '';
  renderGallery(); renderResults();
}, true);
document.querySelectorAll('[data-sort]').forEach(button => button.addEventListener('click', () => { sort = button.dataset.sort; document.querySelectorAll('[data-sort]').forEach(item => item.classList.toggle('active', item === button)); renderResults(); }));
$('#time-limit').addEventListener('change', renderResults); $('#cost-limit').addEventListener('change', renderResults); $('#origin-open').addEventListener('click', () => { routeRequestSequence += 1; originDialog(); }); $('#origin-edit').addEventListener('click', () => { routeRequestSequence += 1; originDialog(); }); $('#modal-close').addEventListener('click', () => { routeRequestSequence += 1; galleryRequestSequence += 1; galleryState = null; $('#modal').close(); });
$('#modal').addEventListener('click', event => { if (event.target !== $('#modal')) return; const rect = $('#modal').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) { routeRequestSequence += 1; galleryRequestSequence += 1; galleryState = null; $('#modal').close(); } });
document.addEventListener('click', event => {
  const filterButton = event.target.closest('[data-photo-filter]');
  if (filterButton && galleryState) { galleryState.filter = filterButton.dataset.photoFilter; galleryState.index = 0; renderGallery(); return; }
  if (event.target.closest('[data-retry-photos]') && galleryState) { void loadPlacePhotos(galleryState.item, true).catch(() => {}); renderGallery(); return; }
  const openPortrait = event.target.closest('[data-open-portrait-app]');
  const copyPortrait = event.target.closest('[data-copy-portrait]');
  if (openPortrait || copyPortrait) {
    const tile = (openPortrait || copyPortrait).closest('.portrait-search');
    const input = tile.querySelector('.portrait-keyword');
    const status = tile.querySelector('.portrait-launch-status');
    status.hidden = false;
    status.textContent = openPortrait ? '正在请求打开小红书。若只进入首页，请粘贴上面的关键词搜索。' : '正在复制关键词…';
    if (openPortrait) tile.querySelector('.portrait-app-fallback').hidden = false;
    const copied = () => { status.textContent = openPortrait ? '关键词已复制。若没有直接进入结果，请在小红书搜索框粘贴。' : '关键词已复制，可粘贴到小红书搜索。'; };
    const manualCopy = () => { status.textContent = '浏览器未允许自动复制。请点击「复制关键词」或长按上面的关键词复制。'; if (copyPortrait) { input.focus(); input.select(); } };
    // Do not await clipboard permission: the native link must keep its user gesture.
    try { if (navigator.clipboard?.writeText) navigator.clipboard.writeText(input.value).then(copied, manualCopy); else manualCopy(); } catch { manualCopy(); }
    return;
  }
  const gallery = event.target.closest('[data-gallery]'); if (gallery) { openGallery(gallery.dataset.gallery); return; }
  const galleryIndex = event.target.closest('[data-gallery-index]'); if (galleryIndex && galleryState) { galleryState.index = Number(galleryIndex.dataset.galleryIndex) || 0; renderGallery(); return; }
  const galleryNav = event.target.closest('[data-gallery-nav]'); if (galleryNav && galleryState) { galleryState.index += Number(galleryNav.dataset.galleryNav) || 0; renderGallery(); return; }
  const routeMode = event.target.closest('[data-route-mode]'); if (routeMode) { routeDialog(routeMode.dataset.place, routeMode.dataset.routeMode); return; }
  const route = event.target.closest('[data-route]'); if (route) routeDialog(route.dataset.route);
  const use = event.target.closest('[data-use-origin]'); if (use) { originId = use.dataset.useOrigin; liveRoutes.clear(); routeModeCache.clear(); routeQueriedAt = null; render(); $('#modal').close(); notify('已切换出发点，请重新查询路线。'); }
  const setDefault = event.target.closest('[data-default-origin]'); if (setDefault) { defaultId = setDefault.dataset.defaultOrigin; originId = defaultId; liveRoutes.clear(); routeModeCache.clear(); routeQueriedAt = null; const ok = saveOrigins(); render(); originDialog(); if (ok) notify('已保存默认出发点。'); }
  const choose = event.target.closest('[data-choose]'); if (choose) { selected = place(choose.dataset.choose); $('#selection-banner').textContent = `已选择：${selected.name}。出发前请核对景区开放情况。`; $('#selection-banner').hidden = false; $('#modal').close(); notify(`已选择 ${selected.name}`); }
  if (event.target.closest('#upload-empty')) { $('#photo-file').click(); return; }
  if (event.target.closest('#reset-filters')) { $('#time-limit').value = '999'; $('#cost-limit').value = '999'; renderResults(); }
});
document.addEventListener('keydown', event => { if (!galleryState || !$('#modal').open || !$('#modal-content .photo-gallery')) return; if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); galleryState.index += event.key === 'ArrowLeft' ? -1 : 1; renderGallery(); } });
document.addEventListener('change', event => { const checkbox = event.target.closest('[data-compare]'); if (!checkbox) return; if (checkbox.checked) { if (comparison.size === 3) { checkbox.checked = false; notify('最多比较 3 个地点，请先取消一个。'); return; } comparison.add(checkbox.dataset.compare); } else comparison.delete(checkbox.dataset.compare); renderCompareBar(); });
document.addEventListener('submit', event => { if (event.target.id !== 'origin-form') return; event.preventDefault(); const form = new FormData(event.target), name = String(form.get('name') || '').trim(), address = String(form.get('address') || '').trim(); if (!name || !address) { notify('请填写出发点名称和完整地址。'); return; } if (origins.length >= 23) { notify('最多保存 20 个自定义出发点。'); return; } const item = { id: `custom-${Date.now()}`, name, address }; origins.push(item); originId = item.id; if (form.get('isDefault')) defaultId = item.id; liveRoutes.clear(); routeModeCache.clear(); routeQueriedAt = null; const ok = saveOrigins(); render(); $('#modal').close(); if (ok) notify('已保存出发点，请查询路线。'); });
$('#departure-time').addEventListener('change', () => { liveRoutes.clear(); routeModeCache.clear(); routeQueriedAt = null; renderResults(); notify('出发时间已修改，请重新查询路线。'); });
$('#clear-compare').addEventListener('click', () => { comparison.clear(); renderResults(); }); $('#show-compare').addEventListener('click', () => { routeRequestSequence += 1; compareDialog(); }); $('#ranking-info').addEventListener('click', () => { routeRequestSequence += 1; rankingDialog(); }); $('#design-notes').addEventListener('click', () => { routeRequestSequence += 1; notesDialog(); });

document.documentElement.classList.toggle('mobile-xhs', /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && navigator.platform === 'MacIntel'));
$('#source-image').referrerPolicy = 'no-referrer'; defaultDeparture(); render(); checkServices();
if (document.modelContext?.registerTool) {
  const lifetime = new AbortController(); window.addEventListener('pagehide', () => lifetime.abort(), { once: true });
  const tools = [
    { name: 'read_scenery_recommendations', description: '读取当前候选地点、照片特征和最近查询的公共交通数据。', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: () => ({ origin: origin().name, routeQueriedAt, places: ranked().map(item => ({ name: item.name, ...metrics(item) })) }) },
    { name: 'set_scenery_sort', description: '修改页面的景色地点排序偏好。', inputSchema: { type: 'object', properties: { sort: { type: 'string', enum: ['balanced', 'similarity', 'time', 'cost'] } }, required: ['sort'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: input => { if (!input || typeof input !== 'object' || !['balanced', 'similarity', 'time', 'cost'].includes(input.sort) || Object.keys(input).some(key => key !== 'sort')) throw new Error('无效的排序方式'); sort = input.sort; document.querySelectorAll('[data-sort]').forEach(button => button.classList.toggle('active', button.dataset.sort === sort)); renderResults(); return { sort, orderedPlaces: ranked().map(item => item.name) }; } },
  ];
  for (const tool of tools) { try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifetime.signal })).catch(() => {}); } catch {} }
}
