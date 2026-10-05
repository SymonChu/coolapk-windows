// 使用真实桌面 WebView 和键盘事件回归连续 Esc 导致话题列表跳回旧帖的问题。
const port = Number(process.env.CDP_PORT || 9226);
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = targets.find(item => item.type === 'page' && item.url.startsWith('http://127.0.0.1:17520/'));
if (!target?.webSocketDebuggerUrl) throw new Error('未找到桌面开发程序 CDP 页面');
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  const callback = pending.get(message.id);
  if (!callback) return;
  pending.delete(message.id);
  if (message.error) callback.reject(new Error(JSON.stringify(message.error)));
  else callback.resolve(message.result);
});
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};
const escape = async () => {
  const key = { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 };
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...key });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
  return evaluate('(async () => { await new Promise(resolve => setTimeout(resolve, 180)); return window.__commentEscapeRegression.snapshot(); })()');
};
try {
  await send('Runtime.enable');
  // 刷新以排除开发热更新遗留的模块实例，确保验证当前磁盘代码。
  await send('Page.reload');
  await new Promise(resolve => setTimeout(resolve, 1000));
  const before = await evaluate(`(async () => {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    const wait = async predicate => { for (let i = 0; i < 300; i++) { const value = predicate(); if (value) return value; await delay(100); } throw new Error('等待话题或评论加载超时'); };
    await wait(() => document.querySelector('.top-bar'));
    location.hash = '#/topic/ColorOS17';
    const hot = await wait(() => [...document.querySelectorAll('.filter-btn')].find(item => item.innerText.trim() === '热度'));
    if (!hot.classList.contains('active')) hot.click();
    await wait(() => document.querySelector('.feed-card .comment-btn')?.innerText.length > 2);
    const scroll = document.querySelector('.page-container.custom-scrollbar');
    const first = [...scroll.querySelectorAll('.feed-card')][3];
    first.scrollIntoView({ block: 'start', behavior: 'instant' });
    first.querySelector('.comment-btn').click();
    await wait(() => first.querySelector('.comment-row'));
    for (let i = 0; i < 6 && scroll.querySelectorAll('.feed-card').length < 32; i++) { scroll.scrollTop = scroll.scrollHeight; await delay(1200); }
    const cards = [...scroll.querySelectorAll('.feed-card')];
    if (cards.length < 25) throw new Error('列表未能加载足够多的帖子');
    const current = cards.slice(23).find(card => Number(card.querySelector('.comment-btn')?.innerText) >= 100);
    if (!current) throw new Error('未找到评论较多的后续帖子');
    current.scrollIntoView({ block: 'start', behavior: 'instant' });
    current.querySelector('.comment-btn').click();
    await wait(() => current.querySelectorAll('.comment-row').length >= 20);
    await delay(500);
    current.querySelectorAll('.comment-row')[19].scrollIntoView({ block: 'center', behavior: 'instant' });
    await delay(300);
    const snapshot = () => ({ scrollTop: Math.round(scroll.scrollTop), oldOpen: !!first.querySelector('.inline-comment-wrapper'), currentOpen: !!current.querySelector('.inline-comment-wrapper'), oldFeedId: first.dataset.feedId, currentFeedId: current.dataset.feedId });
    window.__commentEscapeRegression = { first, current, scroll, snapshot };
    // 焦点放在卡片上，避免测试脚本继承输入框焦点。
    document.activeElement?.blur();
    return snapshot();
  })()`);
  const afterFirst = await escape();
  const afterSecond = await escape();
  if (afterFirst.currentOpen || !afterFirst.oldOpen) throw new Error('首次 Esc 没有只关闭当前评论');
  if (!afterSecond.oldOpen || Math.abs(afterSecond.scrollTop - afterFirst.scrollTop) > 2) throw new Error('第二次 Esc 仍关闭旧评论或导致滚动跳动');
  await evaluate('(async () => { window.__commentEscapeRegression.first.scrollIntoView({ block: "start", behavior: "instant" }); await new Promise(resolve => setTimeout(resolve, 200)); })()');
  const afterReturn = await escape();
  if (afterReturn.oldOpen) throw new Error('滚回旧帖后 Esc 无法正常收起评论');
  console.log(JSON.stringify({ passed: true, before, afterFirst, afterSecond, afterReturn }, null, 2));
} finally {
  try { await evaluate('delete window.__commentEscapeRegression'); } catch { /* 页面已关闭时无需清理。 */ }
  socket.close();
}
