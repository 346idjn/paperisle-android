(() => {
  'use strict';
  const baseSave = save;
  const baseRender = render;
  const baseHomeScreen = homeScreen;
  const baseStatsScreen = statsScreen;
  const baseNotesScreen = notesScreen;
  const baseSettingsScreen = settingsScreen;
  const baseReaderScreen = readerScreen;
  const baseOpenNote = openNote;
  const baseHandleAction = handleAction;
  const basePaginateReader = paginateReader;
  const baseSetReaderPage = setReaderPage;
  const baseRecordMinute = recordMinute;

  if (!state.goal || typeof state.goal !== 'object') state.goal = {minutes: 30, year: 24};
  state.goal.words = Math.max(100, Number(state.goal.words || load('pi_word_goal', 3000)));
  state.accent = load('pi_accent', 'sage');
  state.ttsConfig = load('pi_tts_config', {provider: 'system', region: 'japaneast', voice: 'zh-CN-XiaoxiaoNeural', customUrl: '', hasKey: false});
  try { localStorage.removeItem('pi_ai_config'); if (!localStorage.getItem('pi_ai_removed_v1')) { if (window.Android && Android.clearSecret) Android.clearSecret('ai_key'); localStorage.setItem('pi_ai_removed_v1', '1'); } } catch (_) {}
  state.syncConfig = load('pi_sync_config', {url: '', username: '', configured: false});
  if (!Array.isArray(state.notes)) state.notes = [];
  state.notes.forEach((n, i) => { if (!n.id) n.id = `legacy-${n.bookId || 'book'}-${n.date || i}-${i}`; if (!n.type) n.type = 'quote'; });

  const palette = {
    sage: ['#355d49', '#244534', '#e6eee6'],
    ocean: ['#35647a', '#264b60', '#e3edf2'],
    plum: ['#74516e', '#593c54', '#f0e7ef'],
    terracotta: ['#a45d48', '#804332', '#f4e7e1'],
    ink: ['#48515f', '#323946', '#e8eaf0']
  };
  const colorMap = { yellow: '#f5df9d', mint: '#b9dec3', blue: '#bed8f3', rose: '#f3c2c4', violet: '#ddc9f0' };
  const colorNames = { yellow: '暖黄', mint: '薄荷', blue: '雾蓝', rose: '豆沙', violet: '浅紫' };
  const noteTypes = { quote: '摘录', highlight: '高亮', thought: '想法', question: '问题', summary: '摘要' };
  const id = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `pi-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const escHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const noteColor = note => colorMap[note.colorKey] || note.color || colorMap.yellow;
  const countWords = text => Array.from(String(text || '')).filter(ch => /[A-Za-z0-9\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(ch)).length;
  const todayWordsKey = () => `pi_words_${localDate()}`;
  const readTodayWords = () => Number(load(todayWordsKey(), 0)) || 0;
  const addTodayWords = amount => { if (amount > 0) localStorage.setItem(todayWordsKey(), JSON.stringify(readTodayWords() + amount)); };
  const setAccent = value => { state.accent = palette[value] ? value : 'sage'; document.body.dataset.accent = state.accent; save(); if (state.screen === 'settings') render(); };
  const pageFingerprint = text => { let h = 2166136261; for (const c of text) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };

  const styles = document.createElement('style');
  styles.textContent = `
    body[data-accent="sage"]{--green:#355d49;--green2:#e6eee6}
    body[data-accent="ocean"]{--green:#35647a;--green2:#e3edf2}
    body[data-accent="plum"]{--green:#74516e;--green2:#f0e7ef}
    body[data-accent="terracotta"]{--green:#a45d48;--green2:#f4e7e1}
    body[data-accent="ink"]{--green:#48515f;--green2:#e8eaf0}
    body[data-theme="night"][data-accent="ocean"]{--green:#91c6dd;--green2:#30424a}
    body[data-theme="night"][data-accent="plum"]{--green:#d4afd0;--green2:#463a47}
    body[data-theme="night"][data-accent="terracotta"]{--green:#e1a18a;--green2:#493831}
    body[data-theme="night"][data-accent="ink"]{--green:#bdc6db;--green2:#383c48}
    .daily-word-card{display:flex;align-items:center;gap:12px;background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:13px 15px;margin:10px 0 20px;box-shadow:0 5px 18px rgba(38,54,44,.035)}
    .word-mark{width:36px;height:36px;display:grid;place-items:center;border-radius:13px;background:var(--green2);color:var(--green);font-size:15px;font-weight:800;flex:none}
    .word-copy{min-width:0;flex:1}.word-copy strong{font-size:14px}.word-copy small{color:var(--muted);font-size:10px}.word-meter{height:5px;background:var(--soft);border-radius:5px;margin-top:7px;overflow:hidden}.word-meter i{height:100%;display:block;border-radius:inherit;background:var(--green)}
    .accent-picker{display:flex;gap:10px;flex-wrap:wrap;padding:4px 0 12px}.accent-swatch{width:32px;height:32px;border:3px solid var(--paper);outline:1px solid var(--line);border-radius:50%;padding:0}.accent-swatch.selected{outline:2px solid var(--ink)}
    .feature-note{font-size:10px;line-height:1.7;color:var(--muted);margin:7px 0 12px}
    .year-heat{display:grid;grid-template-columns:repeat(53,minmax(0,1fr));grid-template-rows:repeat(7,7px);gap:3px;overflow:hidden;padding:8px 0 4px}.year-heat .heat{width:100%;height:7px;border-radius:2px}
    .hourly-bars{height:74px;display:flex;align-items:flex-end;justify-content:space-between;gap:2px;padding:7px 0 0}.hour-bar{flex:1;min-width:2px;background:var(--green2);border-radius:3px 3px 1px 1px;position:relative}.hour-bar.active{background:var(--green)}.hour-labels{display:flex;justify-content:space-between;color:var(--muted);font-size:9px;margin-top:5px}
    .book-rank{display:grid;gap:9px;margin-top:12px}.book-rank-row{display:flex;align-items:center;gap:9px;font-size:11px}.book-rank-no{width:20px;height:20px;border-radius:7px;background:var(--green2);color:var(--green);display:grid;place-items:center;font-size:10px;font-weight:750}.book-rank-title{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.book-rank-time{color:var(--muted);font-variant-numeric:tabular-nums}
    .note-type-pill{display:inline-flex;align-items:center;border-radius:20px;background:var(--green2);color:var(--green);padding:3px 8px;font-size:9px;margin-right:5px}.note-type-pill.highlight{background:#f5df9d;color:#59491f}.note-actions{flex-wrap:wrap}.note-color-row{display:flex;gap:9px;align-items:center;margin:7px 0 12px}.note-color-choice{width:27px;height:27px;border-radius:50%;border:2px solid var(--paper);outline:1px solid var(--line);padding:0}.note-color-choice.selected{outline:2px solid var(--ink)}.modal select{width:100%;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--paper);color:var(--ink);margin:4px 0 10px}.reader-highlight{border-radius:3px;color:inherit;padding:0 1px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
    .reader-ai-button{border:1px solid var(--line);background:var(--paper);border-radius:10px;color:var(--green);font-size:10px;font-weight:800;width:32px;height:32px}
    @media(max-width:390px){.year-heat{gap:2px;grid-template-rows:repeat(7,5px)}.year-heat .heat{height:5px}.hourly-bars{gap:1px}}
  `;
  document.head.appendChild(styles);

  save = function(){
    baseSave();
    localStorage.setItem('pi_word_goal', JSON.stringify(state.goal.words));
    localStorage.setItem('pi_accent', JSON.stringify(state.accent));

    localStorage.setItem('pi_tts_config', JSON.stringify(state.ttsConfig));
    localStorage.setItem('pi_sync_config', JSON.stringify(state.syncConfig));
  };
  render = function(){ document.body.dataset.accent = state.accent; baseRender(); document.body.dataset.accent = state.accent; };
  homeScreen = function(){
    let html = baseHomeScreen();
    const percent = Math.min(100, Math.round(readTodayWords() / Math.max(1, state.goal.words) * 100));
    const card = `</section><section class="daily-word-card"><div class="word-mark">字</div><div class="word-copy"><strong>今日阅读字数</strong><br><small>${readTodayWords().toLocaleString()} / ${state.goal.words.toLocaleString()} 字</small><div class="word-meter"><i style="width:${percent}%"></i></div></div><span class="section-meta">${percent}%</span></section>`;
    return html.replace('</section><div class="section-title-row"><h2 class="section-title">正在读', card + '<div class="section-title-row"><h2 class="section-title">正在读');
  };
  statsScreen = function(){
    const original = baseStatsScreen();
    const year = new Date().getFullYear();
    const jan1 = new Date(year, 0, 1); jan1.setDate(jan1.getDate() - ((jan1.getDay() + 6) % 7));
    const cells = Array.from({length: 371}, (_, i) => {
      const d = new Date(jan1); d.setDate(jan1.getDate() + i);
      const inYear = d.getFullYear() === year, v = inYear ? Number(load(`pi_minutes_${localDate(d)}`, 0)) : 0;
      const level = v >= 60 ? 'l4' : v >= 30 ? 'l3' : v >= 10 ? 'l2' : v > 0 ? 'l1' : '';
      return `<i class="heat ${level}" title="${localDate(d)} · ${v} 分钟"></i>`;
    }).join('');
    const hourly = Array.from({length:24}, (_, h) => {
      let mins = 0; for (let k=0;k<30;k++){const d=new Date();d.setDate(d.getDate()-k);mins += Number(load(`pi_hour_${localDate(d)}_${String(h).padStart(2,'0')}`,0))||0;}
      return mins;
    });
    const hmax = Math.max(1, ...hourly);
    const hbars = hourly.map((v,h)=>`<i class="hour-bar ${v?'active':''}" style="height:${Math.max(v?4:2,v/hmax*60)}px" title="${h}:00 · ${v} 分钟"></i>`).join('');
    const rank = state.books.filter(b=>Number(b.minutes)>0).slice().sort((a,b)=>(b.minutes||0)-(a.minutes||0)).slice(0,7);
    const ranks = rank.length ? rank.map((b,i)=>`<div class="book-rank-row"><span class="book-rank-no">${i+1}</span><span class="book-rank-title">${escHtml(b.title)}</span><span class="book-rank-time">${b.minutes||0} 分钟</span></div>`).join('') : '<div class="page-subtitle">开始阅读后会显示单书时长排行。</div>';
    const extras = `<section class="chart-card"><div class="chart-title">${year} 年阅读热力</div><div class="year-heat">${cells}</div><div class="page-footer" style="margin:8px 0 0">按天记录全年阅读时长，颜色越深代表阅读越久。</div></section><section class="chart-card"><div class="chart-title">近 30 天阅读时段</div><div class="hourly-bars">${hbars}</div><div class="hour-labels"><span>0 时</span><span>6 时</span><span>12 时</span><span>18 时</span><span>24 时</span></div></section><section class="chart-card"><div class="chart-title">单书阅读时长排行</div><div class="book-rank">${ranks}</div></section><section class="goal-panel"><div class="chart-title">每日阅读字数</div><div style="display:flex;align-items:baseline;gap:7px;margin:10px 0"><strong style="font-family:Georgia,serif;font-size:24px">${readTodayWords().toLocaleString()}</strong><span class="page-subtitle">/ ${state.goal.words.toLocaleString()} 字</span></div><div class="mini-progress"><i style="display:block;height:100%;width:${Math.min(100,readTodayWords()/Math.max(1,state.goal.words)*100)}%;background:var(--green);border-radius:5px"></i></div></section>`;
    return original.replace('</main>', extras + '</main>');
  };
  notesScreen = function(){
    const notes = state.notes.slice().reverse();
    const cards = notes.length ? notes.map((n, i) => {
      const index = state.notes.length - 1 - i;
      const type = noteTypes[n.type] || '摘录';
      return `<article class="note-card" style="border-left:3px solid ${noteColor(n)}"><div class="note-accent" style="background:${noteColor(n)}"></div><span class="note-type-pill ${n.type==='highlight'?'highlight':''}">${type}</span><p class="note-quote">“${escHtml(n.quote || n.memo || '')}”</p><div class="note-meta"><span>《${escHtml(n.bookTitle || '')}》</span><span>${escHtml(n.date || '')}</span></div>${n.memo && n.quote ? `<p class="note-text">${escHtml(n.memo)}</p>` : ''}<div class="note-actions"><button class="link-action" data-share-note="${index}">分享文字</button><button class="link-action" data-share-image="${index}">图片卡片</button><button class="link-action" data-delete-note="${index}">删除</button></div></article>`;
    }).join('') : `<div class="empty-state" style="margin-top:24px"><div class="empty-icon">${ico('note')}</div>还没有读书笔记。<br>选中句子后可存为摘录、高亮、想法或问题。</div>`;
    return `${topbar()}<main class="screen-in"><div class="page-heading"><div><div class="kicker">读过的字，也留下自己的回声</div><h1 class="page-title">笔记与高亮</h1><div class="page-subtitle">${state.notes.length} 条摘录、想法、问题或高亮。</div></div></div>${cards}<p class="page-footer">笔记保存在本机，可导出文字或生成独立分享卡片。</p></main>`;
  };
  settingsScreen = function(){
    let html = baseSettingsScreen();
    html = html.replace('</button></div><div class="settings-section-label">阅读外观', `</button><button class="setting-row" data-action="words-goal"><span><div class="setting-name">每日阅读字数目标</div><div class="setting-desc">按当天打开并阅读的分页估算</div></span><span class="setting-value">${state.goal.words.toLocaleString()} 字　›</span></button></div><div class="settings-section-label">阅读外观`);
    const swatches = Object.keys(palette).map(key => `<button class="accent-swatch ${state.accent===key?'selected':''}" data-accent="${key}" style="background:${palette[key][0]}" aria-label="${key}"></button>`).join('');
    html = html.replace('<div class="settings-section-label">本地书库', `<div class="settings-section-label">界面主题色</div><div class="settings-group"><div class="setting-row" style="display:block"><div class="setting-name">选择喜欢的强调色</div><div class="accent-picker">${swatches}</div></div></div><div class="settings-section-label">本地书库`);
    return html;
  };
  readerScreen = function(){
    return baseReaderScreen();
  };

  const renderHighlightLine = (line, book) => {
    let best = null;
    const highlights = state.notes.filter(n => n.type === 'highlight' && n.bookId === book.id && n.quote);
    for (const n of highlights) {
      const quote = String(n.quote).replace(/\s+/g, '');
      const text = String(line).replace(/\s+/g, '');
      if (!quote || !text) continue;
      let match = '';
      if (text.includes(quote)) match = quote;
      else if (quote.includes(text) && text.length >= 3) match = text;
      else {
        for (let size=Math.min(text.length, quote.length); size>=4 && !match; size--) {
          for (let i=0; i+size<=text.length; i++) { const part=text.slice(i,i+size); if (quote.includes(part)) { match=part; break; } }
        }
      }
      if (match && (!best || match.length > best.match.length)) best={match,color:noteColor(n)};
    }
    if (!best) return escHtml(line);
    const raw = String(line), at = raw.indexOf(best.match);
    if (at < 0) return `<span class="reader-highlight" style="background:${best.color}">${escHtml(raw)}</span>`;
    return `${escHtml(raw.slice(0,at))}<mark class="reader-highlight" style="background:${best.color}">${escHtml(best.match)}</mark>${escHtml(raw.slice(at+best.match.length))}`;
  };
  paginateReader = function(book){
    basePaginateReader(book);
    if (!book) return;
    document.querySelectorAll('.reader-line').forEach(line => { line.innerHTML = renderHighlightLine(line.textContent, book); });
  };

  let trackedBook = null, trackedPage = -1, trackedAt = 0, dwellTimer = null;
  function recordPageWords(bookId, pageIndex){
    const book = state.books.find(b=>b.id===bookId), page = document.querySelectorAll('.reader-page')[pageIndex];
    if (!book || !page) return;
    const text = Array.from(page.querySelectorAll('.reader-line')).map(x=>x.textContent).join('');
    const amount = countWords(text);
    if (amount < 15) return;
    const date = localDate(), seenKey = `pi_word_pages_${date}`, seen = load(seenKey, {}), key = `${bookId}:${pageFingerprint(text)}`;
    if (seen[key]) return;
    seen[key] = true; localStorage.setItem(seenKey, JSON.stringify(seen)); addTodayWords(amount);
    if (state.screen === 'home' || state.screen === 'stats') render();
  }
  setReaderPage = function(index, persist=true, preserveProgress=false){
    const book = getBook(), beforeId = trackedBook, beforePage = trackedPage;
    if (beforeId && beforePage >= 0 && Date.now()-trackedAt >= 3500) recordPageWords(beforeId, beforePage);
    baseSetReaderPage(index, persist, preserveProgress);
    if (!book) return;
    trackedBook = book.id; trackedPage = readerPageIndex; trackedAt = Date.now();
    clearTimeout(dwellTimer);
    const bookId = trackedBook, page = trackedPage;
    dwellTimer = setTimeout(()=>{ if (state.screen==='reader' && trackedBook===bookId && trackedPage===page) recordPageWords(bookId,page); }, 12000);
  };
  recordMinute = function(){
    baseRecordMinute();
    const key = `pi_hour_${localDate()}_${String(new Date().getHours()).padStart(2,'0')}`;
    localStorage.setItem(key, JSON.stringify((Number(load(key,0))||0)+1));
  };

  homeScreen = function(){
    let html = baseHomeScreen();
    const percent = Math.min(100, Math.round(readTodayWords()/Math.max(1,state.goal.words)*100));
    const card = `</section><section class="daily-word-card"><div class="word-mark">字</div><div class="word-copy"><strong>今日阅读字数</strong><br><small>${readTodayWords().toLocaleString()} / ${state.goal.words.toLocaleString()} 字</small><div class="word-meter"><i style="width:${percent}%"></i></div></div><span class="section-meta">${percent}%</span></section>`;
    return html.replace('</section><div class="section-title-row"><h2 class="section-title">正在读', card + '<div class="section-title-row"><h2 class="section-title">正在读');
  };

  openNote = function(defaultType='quote'){
    const selected = (window.getSelection ? window.getSelection().toString() : '').trim(), book=getBook(); if(!book) return;
    const backdrop=document.createElement('div'); backdrop.className='modal-backdrop';
    const swatches=Object.entries(colorMap).map(([key,color])=>`<button type="button" class="note-color-choice ${key==='yellow'?'selected':''}" data-note-color="${key}" style="background:${color}" aria-label="${colorNames[key]}"></button>`).join('');
    backdrop.innerHTML=`<section class="modal"><h3>保存读书笔记</h3><div class="page-subtitle">《${escHtml(book.title)}》· 可先选中文字</div><label>笔记类型</label><select id="noteType">${Object.entries(noteTypes).map(([key,label])=>`<option value="${key}" ${key===defaultType?'selected':''}>${label}</option>`).join('')}</select><label>摘录或内容</label><textarea id="noteQuote" placeholder="粘贴或输入想留下的句子">${escHtml(selected)}</textarea><label>颜色</label><div class="note-color-row">${swatches}</div><label>我的想法（可选）</label><textarea id="noteMemo" placeholder="写下读到这里时的想法…"></textarea><div class="modal-buttons"><button data-modal-cancel>取消</button><button class="primary" data-modal-save>保存</button></div></section>`;
    document.body.appendChild(backdrop); let colorKey='yellow';
    backdrop.addEventListener('click',e=>{
      const color=e.target.closest('[data-note-color]'); if(color){colorKey=color.dataset.noteColor;backdrop.querySelectorAll('[data-note-color]').forEach(x=>x.classList.toggle('selected',x===color));return;}
      if(e.target===backdrop||e.target.closest('[data-modal-cancel]')){backdrop.remove();return;}
      if(e.target.closest('[data-modal-save]')){
        const quote=backdrop.querySelector('#noteQuote').value.trim(),memo=backdrop.querySelector('#noteMemo').value.trim(),type=backdrop.querySelector('#noteType').value;
        if(!quote&&!memo){toast('先写下摘录或想法');return;}
        state.notes.push({id:id(),type,quote,memo,bookTitle:book.title,bookId:book.id,date:new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric'}).format(new Date()),colorKey,color:colorMap[colorKey],createdAt:Date.now()});save();backdrop.remove();toast(type==='highlight'?'高亮已保存':'笔记已保存');if(type==='highlight'&&state.screen==='reader')render();else if(state.screen==='notes')render();
      }
    });
  };

  function openImageCard(index){
    const note=state.notes[index]; if(!note) return;
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;const c=canvas.getContext('2d');
    const bg=state.readerMode==='night'?'#202b25':state.readerMode==='sepia'?'#f1e5cc':'#fbf9f1';
    c.fillStyle=bg;c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle=noteColor(note);c.fillRect(74,74,10,1202);
    c.fillStyle='#657168';c.font='28px sans-serif';c.fillText('纸屿阅读 · '+(noteTypes[note.type]||'摘录'),120,148);
    c.fillStyle='#28372f';c.font='bold 36px sans-serif';c.fillText('《'+String(note.bookTitle||'').slice(0,22)+'》',120,224);
    c.fillStyle='#27382f';c.font='46px serif';const text='“'+String(note.quote||note.memo||'')+'”',maxWidth=820,lineHeight=82;let y=355,line='';
    for(const ch of Array.from(text)){if(c.measureText(line+ch).width>maxWidth&&line){c.fillText(line,120,y);y+=lineHeight;line=ch;}else line+=ch;}if(line)c.fillText(line,120,y);
    y=Math.min(1030,y+95);if(note.memo){c.fillStyle='#657168';c.font='30px sans-serif';line='';for(const ch of Array.from(note.memo)){if(c.measureText(line+ch).width>maxWidth&&line){c.fillText(line,120,y);y+=52;line=ch;}else line+=ch;}if(line)c.fillText(line,120,y);}
    c.fillStyle='#899189';c.font='24px sans-serif';c.fillText('摘录自《'+String(note.bookTitle||'纸屿阅读')+'》',120,1230);
    const data=canvas.toDataURL('image/png').split(',')[1];
    if(window.Android&&Android.shareImageBase64)Android.shareImageBase64(data);
    else {const a=document.createElement('a');a.href='data:image/png;base64,'+data;a.download='纸屿-摘录卡.png';a.click();toast('图片卡片已导出');}
  }
  function askWordsGoal(){
    const value=prompt('每天希望阅读多少字？',state.goal.words);
    if(value===null)return;const n=Math.floor(Number(value));if(!Number.isFinite(n)||n<100){toast('目标至少为 100 字');return;}
    state.goal.words=Math.min(100000,n);save();render();toast('每日字数目标已更新');
  }
  handleAction = function(action,el){
    if(action==='words-goal'){askWordsGoal();return;}
    if(action==='sync-now'||action==='sync-config'||action==='tts-config'){toast('在线服务设置即将在下一步接入');return;}
    if(action==='make-note'){openNote('quote');return;}
    if(action==='highlight'){openNote('highlight');return;}
    if(action==='tts'){
      const book=getBook();if(!book)return;
      if(state.tts){if(window.Android&&Android.stopSpeech)Android.stopSpeech();if(window.speechSynthesis)speechSynthesis.cancel();state.tts=false;}
      else {state.tts=true;if(window.Android&&Android.speakText)Android.speakText(book.content||'');else if(window.speechSynthesis){const u=new SpeechSynthesisUtterance(book.content||'');u.lang='zh-CN';u.rate=state.speed;speechSynthesis.speak(u);}}
      render();return;
    }
    if(action==='delete-book'){
      const item=state.books.find(x=>x.id===(el&&el.dataset.bookId));if(!item)return;
      showConfirm('从书架移除这本书？','《'+item.title+'》以及这本书的笔记会一并删除。',()=>{state.books=state.books.filter(x=>x.id!==item.id);state.notes=state.notes.filter(x=>x.bookId!==item.id);save();render();toast('已从书架移除')});return;
    }
    baseHandleAction(action,el);
  };

  app.addEventListener('click',e=>{
    const accent=e.target.closest('.accent-swatch[data-accent]');if(accent){setAccent(accent.dataset.accent);return;}
    const image=e.target.closest('[data-share-image]');if(image){openImageCard(Number(image.dataset.shareImage));return;}
  });
  document.body.dataset.accent=state.accent;
  render();
})();
