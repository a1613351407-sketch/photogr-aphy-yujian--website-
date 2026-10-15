const video = document.querySelector('#hero-video');
const playButton = document.querySelector('#toggle-play');
const soundButton = document.querySelector('#toggle-sound');
const notice = document.querySelector('#video-notice');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let resumeAfterVisibility = false;
const formatTime = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
function syncPlayback() {
  document.body.classList.toggle('is-playing', !video.paused);
  playButton.setAttribute('aria-label', video.paused ? '播放背景视频' : '暂停背景视频');
}
async function playBackground() {
  try { await video.play(); notice.hidden = true; }
  catch { notice.textContent = '轻触播放按钮，开始观看影像。'; notice.hidden = false; }
  syncPlayback();
}
video.addEventListener('play', syncPlayback);
video.addEventListener('pause', syncPlayback);
video.addEventListener('timeupdate', () => {
  if (!Number.isFinite(video.duration)) return;
  document.querySelector('#timecode').textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  document.querySelector('#video-progress').style.width = `${video.currentTime / video.duration * 100}%`;
});
video.addEventListener('error', () => {
  notice.textContent = '视频暂时无法加载，你仍可进入拍摄问卷或景区探索。'; notice.hidden = false;
});
playButton.addEventListener('click', () => video.paused ? playBackground() : video.pause());
soundButton.addEventListener('click', () => {
  video.muted = !video.muted;
  document.body.classList.toggle('has-sound', !video.muted);
  soundButton.setAttribute('aria-label', video.muted ? '开启视频声音' : '关闭视频声音');
  soundButton.setAttribute('aria-pressed', String(!video.muted));
});
const menuButton = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('#mobile-nav');
function setMenu(open) { menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单'); mobileNav.hidden = !open; }
menuButton.addEventListener('click', () => setMenu(mobileNav.hidden));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !mobileNav.hidden) { setMenu(false); menuButton.focus(); } });
document.addEventListener('click', event => { if (!event.target.closest('.header')) setMenu(false); });
matchMedia('(min-width: 601px)').addEventListener('change', event => { if (event.matches) setMenu(false); });
motion.addEventListener('change', event => { if (event.matches) video.pause(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { resumeAfterVisibility = !video.paused; video.pause(); }
  else if (resumeAfterVisibility && !motion.matches) playBackground();
});
document.querySelector('#year').textContent = new Date().getFullYear();
if (!motion.matches) playBackground();
