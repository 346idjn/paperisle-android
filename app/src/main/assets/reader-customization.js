(() => {
  'use strict';

  const DEFAULTS = {
    fontSize: 18, lineHeight: 2.05, paragraphGap: 1.28, letterSpacing: 0.035,
    marginX: 10, padTop: 12, padBottom: 10, mainWidth: 480,
    fontFamily: 'serif', textAlign: 'justify', verticalAlign: 'flex-start',
    colorMode: 'paper', bg: '#faf8f1', text: '#293a30', accent: '#355d49',
    autoHide: true, hideDelay: 3.2, turnDuration: 0.3, turnEffect: 'curl', cornerTL: 'clock', cornerTR: 'page', cornerBL: 'none', cornerBR: 'none', layoutRevision: 3, updatedAt: 0
  };
  const PALETTES = {
    paper: { bg: '#f7f1df', paper: '#fffaf0', text: '#29261f', muted: '#8a8273', accent: '#a47729' },
    sepia: { bg: '#f0e8d8', paper: '#f8f1e4', text: '#493c2e', muted: '#8d7d68', accent: '#8a643c' },
    night: { bg: '#1d2521', paper: '#252f29', text: '#e9e8dc', muted: '#a0a99e', accent: '#8ec3a4' }
  };
  const PRESETS = {
    balanced: { fontSize: 18, lineHeight: 2.05, paragraphGap: 1.28, letterSpacing: 0.035, marginX: 10, padTop: 8, padBottom: 8, verticalAlign: 'flex-start', fontFamily: 'serif', textAlign: 'justify', colorMode: 'paper', autoHide: true, hideDelay: 3.2, turnDuration: 0.3 },
    relaxed: { fontSize: 20, lineHeight: 2.12, paragraphGap: 1.42, letterSpacing: 0.04, marginX: 15, padTop: 10, padBottom: 10, verticalAlign: 'flex-start', fontFamily: 'serif', textAlign: 'justify', colorMode: 'sepia', autoHide: true, turnDuration: 0.3 },
    compact: { fontSize: 17, lineHeight: 1.78, paragraphGap: 0.82, letterSpacing: 0.01, marginX: 8, padTop: 8, padBottom: 8, verticalAlign: 'flex-start', fontFamily: 'sans', textAlign: 'left', colorMode: 'paper', autoHide: true, turnDuration: 0.22 },
    night: { fontSize: 18, lineHeight: 2, paragraphGap: 1.2, letterSpacing: 0.025, marginX: 11, padTop: 8, padBottom: 8, verticalAlign: 'flex-start', fontFamily: 'serif', textAlign: 'justify', colorMode: 'night', autoHide: true, turnDuration: 0.3 }
  };
  const clamp = (v, min, max, fallback) => Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback;
  const validColor = (v, fallback) => /^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v) : fallback;
  const loadJson = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; } };
  function normalizePrefs(raw) {
    const p = { ...DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) };
    p.fontSize = clamp(p.fontSize, 14, 32, DEFAULTS.fontSize);
    p.lineHeight = clamp(p.lineHeight, 1.35, 2.6, DEFAULTS.lineHeight);
    p.paragraphGap = clamp(p.paragraphGap, 0.2, 2.5, DEFAULTS.paragraphGap);
    p.letterSpacing = clamp(p.letterSpacing, -0.02, 0.12, DEFAULTS.letterSpacing);
    p.marginX = clamp(p.marginX, 4, 40, DEFAULTS.marginX);
    p.padTop = clamp(p.padTop, 4, 64, DEFAULTS.padTop);
    p.padBottom = clamp(p.padBottom, 4, 64, DEFAULTS.padBottom);
    p.mainWidth = clamp(p.mainWidth, 320, 680, DEFAULTS.mainWidth);
    if (!['serif', 'sans'].includes(p.fontFamily)) p.fontFamily = DEFAULTS.fontFamily;
    if (!['left', 'justify', 'center'].includes(p.textAlign)) p.textAlign = DEFAULTS.textAlign;
    if (!['flex-start', 'center', 'space-evenly', 'space-between'].includes(p.verticalAlign)) p.verticalAlign = DEFAULTS.verticalAlign;
    if (!['paper', 'sepia', 'night', 'custom'].includes(p.colorMode)) p.colorMode = DEFAULTS.colorMode;
    p.bg = validColor(p.bg, DEFAULTS.bg); p.text = validColor(p.text, DEFAULTS.text); p.accent = validColor(p.accent, DEFAULTS.accent); p.layoutRevision = 3;
    p.autoHide = p.autoHide !== false; p.hideDelay = clamp(p.hideDelay, 1.5, 8, DEFAULTS.hideDelay); p.turnDuration = clamp(p.turnDuration, 0, 0.65, DEFAULTS.turnDuration);
    if (!['curl', 'slide'].includes(p.turnEffect)) p.turnEffect = DEFAULTS.turnEffect;
    const cornerValues=['none','page','progress','clock','elapsed']; for (const key of ['cornerTL','cornerTR','cornerBL','cornerBR']) if(!cornerValues.includes(p[key])) p[key]=DEFAULTS[key];
    return p;
  }

  const storedPrefs = loadJson('pi_reader_style', null);
  if (storedPrefs && typeof storedPrefs === 'object' && Number(storedPrefs.layoutRevision || 0) < 3) {
    if (Number(storedPrefs.layoutRevision || 0) < 2 && storedPrefs.verticalAlign === 'center') storedPrefs.verticalAlign = 'flex-start';
    if (storedPrefs.cornerTL === 'none' && storedPrefs.cornerBR === 'clock') { storedPrefs.cornerTL = 'clock'; storedPrefs.cornerBR = 'none'; }
    storedPrefs.layoutRevision = 3; localStorage.setItem('pi_reader_style', JSON.stringify(storedPrefs));
  }
  state.readerPrefs = normalizePrefs(storedPrefs || DEFAULTS);
  state.font = state.readerPrefs.fontSize;
  state.readerMode = state.readerPrefs.colorMode === 'custom' ? 'paper' : state.readerPrefs.colorMode;
  const bookmarksKey = 'pi_reader_bookmarks';
  const deletedBookmarksKey = 'pi_deleted_reader_bookmarks';
  const readBookmarks = () => { const value = loadJson(bookmarksKey, []); return Array.isArray(value) ? value : []; };
  const readDeletedBookmarks = () => { const value = loadJson(deletedBookmarksKey, []); return Array.isArray(value) ? value : []; };
  function prefs() { state.readerPrefs = normalizePrefs(state.readerPrefs); return state.readerPrefs; }
  function persistPrefs() {
    const p = prefs(); p.layoutRevision = 3; p.updatedAt = Date.now();
    localStorage.setItem('pi_reader_style', JSON.stringify(p));
    localStorage.setItem('pi_reader_mode', JSON.stringify(state.readerMode));
  }
  function persistBookmarks(items) { localStorage.setItem(bookmarksKey, JSON.stringify(items)); }
  function html(value) { return typeof esc === 'function' ? esc(String(value == null ? '' : value)) : String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  const style = document.createElement('style');
  style.id = 'reader-customization-styles';
  style.textContent = `
    .reader-screen{position:relative}
    .reader-main{box-sizing:border-box;width:100%;max-width:min(100%,var(--reader-main-width,480px));padding:0!important}
    .reader-screen .reader-prelude,.reader-screen .reader-title,.reader-screen .reader-byline{display:none!important}
    .reader-edge-info{position:absolute;inset:0;z-index:25;pointer-events:none}
    .reader-edge-widget{position:absolute;max-width:43%;padding:5px 8px;border-radius:999px;background:color-mix(in srgb,var(--reader-paper,#fffdf8) 94%,transparent);color:var(--reader-muted,#879087);font:600 10px/1.2 system-ui,sans-serif;font-variant-numeric:tabular-nums;backdrop-filter:blur(6px);opacity:0;transition:opacity .18s ease;white-space:nowrap}
    .reader-screen.controls-faded .reader-edge-widget:not([hidden]){opacity:.9}
    .reader-edge-tl{top:calc(max(24px,env(safe-area-inset-top,0px),var(--app-system-top-inset,0px)) + 8px);left:10px}
    .reader-edge-tr{top:calc(max(24px,env(safe-area-inset-top,0px),var(--app-system-top-inset,0px)) + 8px);right:10px}
    .reader-edge-bl{bottom:calc(10px + max(env(safe-area-inset-bottom,0px),var(--app-system-bottom-inset,0px)));left:10px}
    .reader-edge-br{bottom:calc(10px + max(env(safe-area-inset-bottom,0px),var(--app-system-bottom-inset,0px)));right:10px}
    .reader-title,.reader-top-title,.reader-body{font-family:var(--reader-font-family,"Noto Serif SC","Songti SC",Georgia,serif)}
    .reader-title{font-size:calc(var(--reader-font-size,18px)*1.35)}
    .reader-body{letter-spacing:var(--reader-letter-spacing,.035em);transition:transform var(--reader-turn-duration,.3s) cubic-bezier(.22,.7,.25,1)}
    .reader-page{display:flex;flex-direction:column;justify-content:var(--reader-vertical-align,center);padding:calc(var(--reader-pad-top,12px) + var(--reader-corner-top-space,0px)) var(--reader-margin-x,10px) calc(var(--reader-pad-bottom,10px) + var(--reader-corner-bottom-space,0px));text-align:var(--reader-text-align,justify)}
    .reader-line{height:calc(var(--reader-line-height,2.05)*1em);line-height:var(--reader-line-height,2.05);flex:0 0 auto;text-align:inherit}
    .reader-paragraph-gap{height:calc(var(--reader-paragraph-gap,1.28)*1em);flex:0 0 auto}
    .reader-screen .reader-top,.reader-screen .reader-prelude,.reader-screen .reader-title,.reader-screen .reader-byline,.reader-screen .reader-dock{transition:opacity .2s ease,visibility 0s linear 0s}
    .reader-screen.controls-faded .reader-top,.reader-screen.controls-faded .reader-prelude,.reader-screen.controls-faded .reader-title,.reader-screen.controls-faded .reader-byline,.reader-screen.controls-faded .reader-dock{opacity:0;visibility:hidden;pointer-events:none;transition:opacity .2s ease,visibility 0s linear .2s}
    .reader-tool[data-reader-action]{font-weight:750;letter-spacing:-.04em}
    .reader-style-overlay{position:fixed;z-index:120;inset:0;background:rgba(18,25,21,.46);backdrop-filter:blur(8px);display:flex;align-items:flex-end;justify-content:center;padding-top:env(safe-area-inset-top,0px)}
    .reader-style-sheet{width:min(100%,560px);max-height:94dvh;display:flex;flex-direction:column;background:var(--paper,#fffdf8);color:var(--ink,#27382f);border-radius:24px 24px 0 0;box-shadow:0 -16px 50px rgba(0,0,0,.18);overflow:hidden;padding-bottom:calc(10px + max(env(safe-area-inset-bottom,0px),var(--app-system-bottom-inset,0px)))}
    .reader-style-header{display:flex;align-items:center;justify-content:space-between;padding:17px 20px 12px;border-bottom:1px solid var(--line,#e8e5da);flex:none}
    .reader-style-title{font-size:17px;font-weight:780;letter-spacing:.02em}.reader-style-subtitle{font-size:11px;color:var(--muted,#879087);margin-top:4px}
    .reader-style-close{width:38px;height:38px;border:0;border-radius:14px;background:var(--soft,#efede5);color:var(--ink,#27382f);font-size:20px}
    .reader-style-content{overflow:auto;overscroll-behavior:contain;padding:14px 18px 18px;display:grid;gap:14px}
    .reader-style-block{border:1px solid var(--line,#e8e5da);border-radius:18px;background:color-mix(in srgb,var(--paper,#fffdf8) 80%,var(--bg,#f4f2ea));padding:13px}
    .reader-style-block h3{font-size:12px;margin:0 0 10px;color:var(--muted,#879087);font-weight:750;letter-spacing:.06em}
    .reader-style-presets{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
    .reader-style-preset{min-height:44px;border:1px solid var(--line,#e8e5da);border-radius:13px;background:var(--paper,#fffdf8);color:var(--ink,#27382f);font-size:11px;font-weight:700;padding:6px 3px}
    .reader-style-preset:active,.reader-style-preset.active{border-color:var(--green,#355d49);box-shadow:inset 0 0 0 1px var(--green,#355d49);color:var(--green,#355d49)}
    .reader-style-control{display:grid;grid-template-columns:1fr auto;align-items:center;gap:5px 10px;margin:10px 0}
    .reader-style-control>span:first-child{font-size:12px;font-weight:650}.reader-style-value{font-size:11px;color:var(--muted,#879087);font-variant-numeric:tabular-nums}
    .reader-style-control input[type=range]{grid-column:1/-1;width:100%;height:24px;accent-color:var(--green,#355d49);margin:0}
    .reader-style-control select{grid-column:1/-1;height:42px;border:1px solid var(--line,#e8e5da);border-radius:12px;background:var(--paper,#fffdf8);color:var(--ink,#27382f);padding:0 11px;font:inherit;font-size:12px}
    .reader-style-colors{display:grid;grid-template-columns:1fr 1fr;gap:10px}.reader-style-color{display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:46px;border:1px solid var(--line,#e8e5da);border-radius:13px;padding:7px 9px;font-size:11px;font-weight:650}
    .reader-style-color input{width:34px;height:30px;border:0;background:transparent;padding:0}
    .reader-style-toggle{display:flex;align-items:center;justify-content:space-between;min-height:42px;font-size:12px;font-weight:650}.reader-style-toggle input{width:20px;height:20px;accent-color:var(--green,#355d49)}
    .reader-style-footer{display:flex;gap:9px;padding:10px 18px 8px;border-top:1px solid var(--line,#e8e5da);flex:none}
    .reader-style-footer button{height:45px;border-radius:14px;border:1px solid var(--line,#e8e5da);background:var(--paper,#fffdf8);color:var(--ink,#27382f);font-weight:700;flex:1}
    .reader-style-footer button.primary{background:var(--green,#355d49);border-color:var(--green,#355d49);color:white}
    .reader-bookmark-card{border-color:color-mix(in srgb,var(--gold,#e3bd84) 60%,var(--line,#e8e5da))}
    .reader-bookmark-snippet{font-family:Georgia,"Noto Serif SC",serif;font-size:13px;line-height:1.7;color:var(--ink,#27382f);margin:10px 0}
    @media(max-width:370px){.reader-style-content{padding-left:13px;padding-right:13px}.reader-style-block{padding:11px}.reader-style-preset{font-size:10px}.reader-style-color{font-size:10px}}
  `;
  document.head.appendChild(style);

  const fixedCanvasStyle = document.createElement('style');
  fixedCanvasStyle.textContent = `
    body{height:100dvh;overflow:hidden}
    #app.app:not(.reader-app){height:100dvh;min-height:100dvh;overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;scrollbar-width:none}
    #app.app:not(.reader-app)::-webkit-scrollbar{display:none}
    #app.app.reader-app{height:100dvh;overflow:hidden}
    .book-cover.cover-from-file{color:#fff;background:#27382f}
    .book-cover.cover-from-file:before{display:none}
    .book-cover.cover-from-file:after{z-index:1;inset:0;left:0;right:0;top:0;height:auto;background:linear-gradient(180deg,rgba(0,0,0,.05) 18%,rgba(0,0,0,.68) 100%);transform:none}
    .book-cover.cover-from-file .cover-art{position:absolute;inset:0;z-index:0;width:100%;height:100%;object-fit:cover}
    .book-cover.cover-from-file .cover-kicker,.book-cover.cover-from-file .cover-title,.book-cover.cover-from-file .cover-author{position:relative;z-index:2;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.58)}
    .topbar{box-sizing:border-box;height:calc(66px + var(--app-system-top-inset,0px));padding-top:var(--app-system-top-inset,0px)}
    .reader-screen{position:relative!important;display:block!important;isolation:isolate}
    .reader-screen::before{content:"";position:absolute;left:0;right:0;top:0;height:max(24px,var(--app-system-top-inset,0px));background:var(--reader-bg);z-index:35;pointer-events:none}
    .reader-top{position:absolute!important;left:0!important;right:0!important;top:max(24px,var(--app-system-top-inset,0px))!important;width:100%!important;height:60px!important;box-sizing:border-box;z-index:40}
    .reader-main{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;min-height:0!important;margin:0!important;padding:0!important;display:block!important}
    .reader-scroller{position:absolute!important;top:max(24px,var(--app-system-top-inset,0px))!important;bottom:0!important;left:50%!important;right:auto!important;width:min(100vw,var(--reader-main-width,480px))!important;height:auto!important;min-height:0!important;flex:none!important;transform:translateX(-50%);z-index:0}
    .reader-prelude,.reader-title,.reader-byline{position:relative;z-index:10;box-sizing:border-box;background:var(--reader-bg)}
    .reader-prelude{margin-top:100px;padding:10px 25px 0}
    .reader-title{margin:8px 0 0;padding:0 25px 4px}
    .reader-byline{padding:4px 25px 14px}
    .reader-dock{position:absolute!important;left:0!important;right:0!important;bottom:0!important;width:100%!important;max-width:none!important;margin:0!important;box-sizing:border-box;z-index:40}
    .detail-page{width:min(100%,680px);margin:0 auto;padding:0 20px calc(28px + env(safe-area-inset-bottom,0px));box-sizing:border-box}
    .detail-back-button{border:0;background:transparent;color:var(--green,#355d49);font:700 13px system-ui,sans-serif;padding:12px 0}
    .detail-hero{display:flex;align-items:center;gap:16px;padding:12px 0 18px}
    .detail-cover-wrap{width:112px;flex:none}.detail-cover-wrap .book-cover.detail-cover{height:160px;padding:12px 10px}.detail-cover-wrap .cover-title{font-size:14px}
    .detail-hero-copy{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:8px}.detail-hero-copy h1{font-family:"Noto Serif SC","Songti SC",Georgia,serif;font-size:22px;line-height:1.35;margin:0}.detail-hero-copy p{font-size:12px;color:var(--muted,#879087);margin:0;line-height:1.5}.detail-read-button,.detail-save-button{min-height:42px;border:0;border-radius:13px;background:var(--green,#355d49);color:#fff;padding:0 16px;font-weight:750}
    .detail-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.detail-metrics article{min-width:0;background:var(--paper,#fffdf8);border:1px solid var(--line,#e8e5da);border-radius:15px;padding:12px}.detail-metrics strong{display:block;font-size:18px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.detail-metrics span{display:block;margin-top:5px;font-size:10px;color:var(--muted,#879087)}
    .detail-section{margin-top:15px;padding:15px;background:var(--paper,#fffdf8);border:1px solid var(--line,#e8e5da);border-radius:18px}.detail-section h2{font-size:14px;margin:0 0 12px}.detail-metadata{display:grid;grid-template-columns:1fr 1fr;gap:12px}.detail-metadata>div{min-width:0}.detail-metadata span,.detail-record-list span{display:block;color:var(--muted,#879087);font-size:10px;margin-bottom:4px}.detail-metadata b,.detail-record-list b{font-size:12px;overflow-wrap:anywhere}.detail-description{font-size:12px;line-height:1.7;color:var(--ink,#293a30);margin:14px 0 0;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:6;overflow:hidden}
    .detail-record-list{display:grid;gap:12px}.detail-record-list>div{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line,#e8e5da);padding-bottom:9px}.detail-record-list>div:last-child{border:0;padding-bottom:0}.detail-record-list span{margin:0}.detail-field{display:grid;gap:6px;margin:10px 0;font-size:11px;font-weight:650;color:var(--muted,#879087)}.detail-field input,.detail-field select{box-sizing:border-box;width:100%;height:42px;border:1px solid var(--line,#e8e5da);border-radius:11px;background:var(--paper,#fffdf8);color:var(--ink,#293a30);padding:0 11px;font:inherit;font-size:13px}.detail-save-button{width:100%;margin-top:5px}.book-detail-link{width:100%;margin-top:8px;border:1px solid var(--line,#e8e5da);border-radius:10px;background:var(--paper,#fffdf8);color:var(--green,#355d49);font-size:11px;font-weight:700;padding:8px}
    .reader-scroller{perspective:1450px;transform-style:preserve-3d}
    .page-turn-overlay{position:absolute!important;inset:0 auto auto 0!important;box-sizing:border-box!important;background:var(--reader-paper,#fffdf8)!important;backface-visibility:hidden;transform-style:preserve-3d;will-change:transform,filter;z-index:12;pointer-events:none}
    .page-turn-forward,.page-turn-backward{animation:none!important}
    .page-turn-forward{transform-origin:left center;animation:paperisle-curl-forward var(--reader-turn-duration,.3s) cubic-bezier(.2,.72,.24,1) both}
    .page-turn-backward{transform-origin:right center;animation:paperisle-curl-backward var(--reader-turn-duration,.3s) cubic-bezier(.2,.72,.24,1) both}
    .page-turn-overlay:after{content:"";position:absolute;top:0;bottom:0;width:38%;pointer-events:none;opacity:.55}
    .page-turn-forward:after{right:0;background:linear-gradient(90deg,transparent,rgba(0,0,0,.30))}
    .page-turn-backward:after{left:0;background:linear-gradient(270deg,transparent,rgba(0,0,0,.30))}
    @keyframes paperisle-curl-forward{0%{transform:rotateY(0deg);filter:brightness(1);box-shadow:0 0 0 transparent}48%{filter:brightness(.82);box-shadow:-8px 0 24px rgba(0,0,0,.18)}100%{transform:rotateY(-166deg);filter:brightness(.95);box-shadow:-22px 0 34px rgba(0,0,0,.16);opacity:.08}}
    @keyframes paperisle-curl-backward{0%{transform:rotateY(0deg);filter:brightness(1);box-shadow:0 0 0 transparent}48%{filter:brightness(.82);box-shadow:8px 0 24px rgba(0,0,0,.18)}100%{transform:rotateY(166deg);filter:brightness(.95);box-shadow:22px 0 34px rgba(0,0,0,.16);opacity:.08}}
    @media(max-width:380px){.reader-chapter{display:none}.reader-top{padding-left:10px;padding-right:10px;gap:6px}.reader-top-title{font-size:9px}}
  `;
  document.head.appendChild(fixedCanvasStyle);
  const readerMenuStyle = document.createElement('style');
  readerMenuStyle.textContent = `
    .reader-top{display:flex!important;align-items:center!important;gap:7px!important;padding:0 14px!important;background:linear-gradient(180deg,var(--reader-bg) 78%,color-mix(in srgb,var(--reader-bg) 84%,transparent));backdrop-filter:blur(8px)}
    .reader-top-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px!important;font-weight:650;color:var(--reader-text)}
    .reader-chapter{max-width:25vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--reader-muted);font-size:10px}
    .reader-page-top{white-space:nowrap;color:var(--reader-muted);font-size:10px;font-variant-numeric:tabular-nums}
    .reader-top-icon{width:34px;height:38px;display:grid;place-items:center;flex:none;border:0;border-radius:12px;background:transparent;color:var(--reader-text);padding:0}
    .reader-top-icon.bookmarked{color:var(--reader-accent,var(--green,#a47729))}.reader-top-icon.bookmarked svg{fill:currentColor}
    .reader-top-icon svg,.reader-bottom-item svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
    .reader-bottom-tools{width:min(100%,560px);margin:0 auto;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:center;gap:2px}
    .reader-dock{padding:7px 12px calc(5px + max(env(safe-area-inset-bottom,0px),var(--app-system-bottom-inset,0px)))!important;max-height:calc(82px + max(env(safe-area-inset-bottom,0px),var(--app-system-bottom-inset,0px)))!important;background:color-mix(in srgb,var(--reader-bg) 95%,transparent)!important;border-top:1px solid color-mix(in srgb,var(--reader-text) 8%,transparent)!important;backdrop-filter:blur(14px)}
    .reader-toolbar{display:block!important;width:100%!important}
    .reader-progress-line{display:none!important}
    .reader-bottom-item{min-width:0;height:58px;border:0;background:transparent;color:var(--reader-muted);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:500 10px/1.2 system-ui,sans-serif;padding:3px 1px;touch-action:manipulation}
    .reader-bottom-item:active,.reader-bottom-item.active{color:var(--reader-accent,var(--green,#a47729))}
    .reader-bottom-symbol{height:24px;display:grid;place-items:center;font:400 23px/1 Georgia,serif}
    .reader-bottom-symbol.text-symbol{font:400 22px/1 Georgia,serif}
    .reader-tts-fab{position:absolute;z-index:39;right:max(18px,calc((100vw - 560px)/2 + 18px));bottom:calc(92px + max(env(safe-area-inset-bottom,0px),var(--app-system-bottom-inset,0px)));width:54px;height:54px;border:0;border-radius:50%;background:var(--reader-accent,var(--green,#a47729));color:#fff;font:700 17px/1 system-ui,sans-serif;box-shadow:0 5px 18px rgba(34,29,21,.22);touch-action:manipulation}
    .reader-screen.controls-faded .reader-tts-fab{opacity:.88}
    .reader-panel-overlay{position:fixed;z-index:115;top:var(--app-visual-top,0px);left:0;right:0;height:var(--app-visual-height,100dvh);background:rgba(28,30,24,.34);backdrop-filter:blur(5px);display:flex;align-items:flex-end;justify-content:center;touch-action:pan-y}
    .reader-panel-sheet{width:min(100%,560px);max-height:min(86dvh,calc(var(--app-visual-height,100dvh) - 12px));display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;background:var(--reader-paper,#fffaf0);color:var(--reader-text,#29261f);border-radius:26px 26px 0 0;padding-bottom:calc(10px + max(env(safe-area-inset-bottom,0px),var(--app-system-bottom-inset,0px)));box-shadow:0 -14px 44px rgba(31,29,23,.18)}
    .reader-sheet-handle{width:42px;height:5px;border-radius:99px;background:color-mix(in srgb,var(--reader-text) 18%,transparent);margin:10px auto 2px;flex:none}
    .reader-panel-head{display:flex;align-items:center;justify-content:space-between;padding:13px 21px 12px;border-bottom:1px solid color-mix(in srgb,var(--reader-text) 8%,transparent);flex:none}
    .reader-panel-head h2{font:650 17px/1.3 system-ui,sans-serif;margin:0}
    .reader-panel-head button{width:34px;height:34px;border:0;border-radius:50%;background:color-mix(in srgb,var(--reader-text) 7%,transparent);color:inherit;font-size:21px}
    .reader-panel-scroll{min-height:0;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y pinch-zoom;padding:12px 20px 18px}
    .reader-toc-row{width:100%;min-height:56px;text-align:left;border:0;border-bottom:1px solid color-mix(in srgb,var(--reader-text) 7%,transparent);background:transparent;color:inherit;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 2px;font:500 13px/1.45 system-ui,sans-serif}
    .reader-toc-row.current{color:var(--reader-accent,var(--green,#a47729));font-weight:750}
    .reader-toc-row small{flex:none;color:var(--reader-muted);font-size:10px;font-weight:500}
    .reader-panel-hint{color:var(--reader-muted);font-size:11px;line-height:1.6;margin:0 0 12px}
    .reader-progress-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;text-align:center;padding:14px 0}
    .reader-progress-stats strong{display:block;font-size:21px;font-variant-numeric:tabular-nums}.reader-progress-stats span{display:block;margin-top:3px;color:var(--reader-muted);font-size:10px}
    .reader-page-range{width:100%;height:42px;margin:9px 0 15px;accent-color:var(--reader-accent,var(--green,#a47729));touch-action:pan-y;}
    .reader-panel-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:4px 0 2px}
    .reader-panel-action{min-height:48px;border:0;border-radius:15px;background:color-mix(in srgb,var(--reader-bg,#f7f1df) 76%,var(--reader-paper,#fffaf0));color:var(--reader-text);font:650 13px system-ui,sans-serif}
    .reader-theme-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:18px 0}
    .reader-theme-option{height:94px;border:2px solid transparent;border-radius:18px;display:flex;align-items:flex-end;justify-content:center;padding:10px;font:650 11px system-ui,sans-serif;box-shadow:inset 0 0 0 1px rgba(60,50,30,.08)}
    .reader-theme-option[data-theme="paper"]{background:#f7f1df;color:#29261f}.reader-theme-option[data-theme="sepia"]{background:#efe1c9;color:#493c2e}.reader-theme-option[data-theme="night"]{background:#222a26;color:#eee9d9}
    .reader-theme-option.active{border-color:var(--reader-accent,#a47729)}
    .reader-more-list{display:grid;gap:7px;padding:12px 18px 18px}.reader-more-list button{min-height:50px;border:0;border-radius:14px;text-align:left;padding:0 14px;background:color-mix(in srgb,var(--reader-bg,#f7f1df) 70%,var(--reader-paper,#fffaf0));color:var(--reader-text);font:600 13px system-ui,sans-serif}
    .reader-style-overlay,.modal-backdrop{top:var(--app-visual-top,0px)!important;height:var(--app-visual-height,100dvh)!important;bottom:auto!important}
    .reader-style-sheet,.modal{max-height:calc(var(--app-visual-height,100dvh) - 10px)!important;min-height:0}
    .reader-style-content,.modal{overscroll-behavior:contain;touch-action:pan-y pinch-zoom}
    .reader-style-control input[type=range],.reader-style-control select{touch-action:pan-y}
    .reader-style-sheet{background:#fffaf0!important;color:#29261f!important}
    .reader-style-block{touch-action:pan-y}
    .reader-style-control input[type=range]{height:32px!important;margin:4px 0!important;accent-color:#a47729!important}
    .reader-style-preset.active,.reader-style-preset:active{border-color:#a47729!important;color:#8c641f!important}
    .reader-style-footer button.primary{background:#a47729!important;border-color:#a47729!important}
    @media(max-width:380px){.reader-top{gap:4px!important;padding-left:9px!important;padding-right:9px!important}.reader-top-icon{width:31px}.reader-top-title{font-size:11px!important}.reader-chapter{max-width:21vw}.reader-bottom-item{font-size:9px}}
  `;
  document.head.appendChild(readerMenuStyle);

  function paletteFor(p) {
    if (p.colorMode === 'custom') return { bg: p.bg, paper: p.bg, text: p.text, muted: p.text, accent: p.accent };
    return PALETTES[p.colorMode] || PALETTES.paper;
  }
  let lastNativeNavStyle = '';
  let readerSessionStartedAt = Date.now();
  function cornerText(kind) {
    if(kind==='page') return `${Math.max(0,Number(readerPageIndex)||0)+1} / ${Math.max(1,Number(readerPageCount)||1)}`;
    if(kind==='progress') return `${Math.round((Math.max(0,Number(readerPageIndex)||0)+1)/Math.max(1,Number(readerPageCount)||1)*100)}%`;
    if(kind==='clock') return new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
    if(kind==='elapsed') {const seconds=Math.max(0,Math.floor((Date.now()-readerSessionStartedAt)/1000));const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return h?`已读 ${h}:${String(m).padStart(2,'0')}`:`已读 ${m}:${String(s).padStart(2,'0')}`;}
    return '';
  }
  function ensureCornerInfo(screen) {
    let layer=screen.querySelector('.reader-edge-info');
    if(!layer){layer=document.createElement('div');layer.className='reader-edge-info';layer.innerHTML=['tl','tr','bl','br'].map(c=>`<span class="reader-edge-widget reader-edge-${c}" data-reader-corner="corner${c.toUpperCase()}" hidden></span>`).join('');screen.appendChild(layer);}
    updateCornerInfo();
  }
  function updateCornerInfo() {
    const screen=document.querySelector('.reader-screen');if(!screen)return;
    const p=prefs();
    for(const node of screen.querySelectorAll('[data-reader-corner]')){const kind=p[node.dataset.readerCorner]||'none';node.textContent=cornerText(kind);node.hidden=kind==='none';}
  }
  setInterval(updateCornerInfo,15000);
  function applyPrefs() {
    const p = prefs(); state.font = p.fontSize; state.readerMode = p.colorMode === 'custom' ? 'paper' : p.colorMode;
    const screen = document.querySelector('.reader-screen');
    if (!screen) { lastNativeNavStyle = ''; return; }
    const palette = paletteFor(p);
    const rgb = palette.bg.match(/[0-9a-fA-F]{2}/g) || ['fa', 'f8', 'f1'];
    const lightIcons = (Number.parseInt(rgb[0], 16) * 299 + Number.parseInt(rgb[1], 16) * 587 + Number.parseInt(rgb[2], 16) * 114) / 1000 > 150;
    const navStyle = `${palette.bg}:${lightIcons}`;
    if (state.screen === 'reader' && navStyle !== lastNativeNavStyle && window.Android && Android.setReaderNavigationColor) {
      Android.setReaderNavigationColor(palette.bg, lightIcons); lastNativeNavStyle = navStyle;
    }
    screen.dataset.mode = state.readerMode;
    screen.style.setProperty('--reader-bg', palette.bg);
    screen.style.setProperty('--reader-paper', palette.paper);
    screen.style.setProperty('--reader-text', palette.text);
    screen.style.setProperty('--reader-muted', palette.muted);
    screen.style.setProperty('--green', palette.accent);
    screen.style.setProperty('--reader-main-width', `${p.mainWidth}px`);
    screen.style.setProperty('--reader-font-size', `${p.fontSize}px`);
    screen.style.setProperty('--reader-line-height', String(p.lineHeight));
    screen.style.setProperty('--reader-paragraph-gap', `${p.paragraphGap}em`);
    screen.style.setProperty('--reader-letter-spacing', `${p.letterSpacing}em`);
    screen.style.setProperty('--reader-margin-x', `${p.marginX}px`);
    screen.style.setProperty('--reader-pad-top', `${p.padTop}px`);
    screen.style.setProperty('--reader-pad-bottom', `${p.padBottom}px`);
    screen.style.setProperty('--reader-vertical-align', p.verticalAlign);
    screen.style.setProperty('--reader-text-align', p.textAlign);
    screen.style.setProperty('--reader-corner-top-space', p.cornerTL !== 'none' || p.cornerTR !== 'none' ? '32px' : '0px');
    const bottomInset = Math.max(0, Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-system-bottom-inset')) || 0);
    screen.style.setProperty('--reader-corner-bottom-space', p.cornerBL !== 'none' || p.cornerBR !== 'none' ? `${bottomInset + 42}px` : '0px');
    screen.style.setProperty('--reader-turn-duration', `${p.turnDuration}s`);
    const fontFamily = p.fontFamily === 'sans' ? '"Noto Sans SC", "PingFang SC", Arial, sans-serif' : '"Noto Serif SC", "Songti SC", Georgia, serif';
    screen.style.setProperty('--reader-font-family', fontFamily);
    const body = document.getElementById('readerBody'); if (body) body.style.fontSize = `${p.fontSize}px`;
    const label = screen.querySelector('.reader-tool-label');
    if (label) label.textContent = p.colorMode === 'custom' ? '自定义' : p.colorMode === 'sepia' ? '暖黄' : p.colorMode === 'night' ? '夜读' : '纸白';
    ensureCornerInfo(screen); updateBookmarkButton();
  }

  let reflowTimer = null;
  function reflow(delay = 180) {
    if (reflowTimer) clearTimeout(reflowTimer);
    reflowTimer = setTimeout(() => {
      reflowTimer = null;
      if (state.screen === 'reader' && typeof paginateReader === 'function') paginateReader(getBook());
    }, delay);
  }
  window.onReaderInsetsChanged = () => { if (state.screen === 'reader') { applyPrefs(); reflow(80); } };
  let resizeObserver = null, observedScroller = null, lastScrollerSize = '';
  function attachResizeObserver() {
    const scroller = document.getElementById('readerScroller');
    if (!scroller || !window.ResizeObserver) return;
    if (!resizeObserver) resizeObserver = new ResizeObserver(() => {
      if (state.screen !== 'reader') return;
      const node = document.getElementById('readerScroller'); if (!node) return;
      const size = `${node.clientWidth}x${node.clientHeight}`;
      if (size === lastScrollerSize) return;
      lastScrollerSize = size;
      reflow(240);
    });
    if (observedScroller !== scroller) {
      if (observedScroller) resizeObserver.unobserve(observedScroller);
      observedScroller = scroller; lastScrollerSize = `${scroller.clientWidth}x${scroller.clientHeight}`;
      resizeObserver.observe(scroller);
    }
  }

  scheduleReaderControls = function () {
    const screen = document.querySelector('.reader-screen');
    if (!screen) return;
    screen.classList.remove('controls-hidden', 'controls-faded');
    if (controlsTimer) clearTimeout(controlsTimer);
    controlsTimer = null;
    if (!prefs().autoHide) return;
    const delay = prefs().hideDelay * 1000;
    controlsTimer = setTimeout(() => {
      const current = document.querySelector('.reader-screen');
      if (current === screen && state.screen === 'reader') current.classList.add('controls-faded');
      controlsTimer = null;
    }, delay);
  };
  toggleReaderControls = function () {
    const screen = document.querySelector('.reader-screen'); if (!screen) return;
    if (!prefs().autoHide) {
      screen.classList.remove('controls-hidden', 'controls-faded');
      if (controlsTimer) clearTimeout(controlsTimer); controlsTimer = null;
      return;
    }
    if (screen.classList.contains('controls-faded')) { screen.classList.remove('controls-faded'); scheduleReaderControls(); }
    else { screen.classList.add('controls-faded'); if (controlsTimer) clearTimeout(controlsTimer); controlsTimer = null; }
  };

  function colorOption(key, label, value) {
    return `<label class="reader-style-color"><span>${label}</span><input type="color" data-reader-pref="${key}" value="${validColor(value, '#ffffff')}"></label>`;
  }
  function rangeOption(key, label, min, max, step, unit, digits = 0) {
    const p = prefs(), value = Number(p[key]);
    return `<label class="reader-style-control"><span>${label}</span><output class="reader-style-value" data-reader-value="${key}">${digits ? value.toFixed(digits) : value}${unit}</output><input type="range" data-reader-pref="${key}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
  }
  function selectOption(key, label, options) {
    const p = prefs();
    return `<label class="reader-style-control"><span>${label}</span><select data-reader-pref="${key}">${options.map(([value, name]) => `<option value="${value}" ${String(p[key]) === String(value) ? 'selected' : ''}>${name}</option>`).join('')}</select></label>`;
  }
  function editorHtml() {
    const p = prefs();
    return `<div class="reader-style-overlay" data-reader-backdrop><section class="reader-style-sheet" role="dialog" aria-modal="true" aria-label="自定义阅读页面"><div class="reader-sheet-handle"></div>
      <header class="reader-style-header"><div><div class="reader-style-title">阅读设置</div><div class="reader-style-subtitle">字号、行距与翻页方式会自动保存</div></div><button class="reader-style-close" data-reader-action="close-style" aria-label="关闭">×</button></header>
      <div class="reader-style-content">
        <section class="reader-style-block"><h3>快速预设</h3><div class="reader-style-presets"><button class="reader-style-preset" data-reader-action="preset" data-preset="balanced">均衡</button><button class="reader-style-preset" data-reader-action="preset" data-preset="relaxed">舒展</button><button class="reader-style-preset" data-reader-action="preset" data-preset="compact">紧凑</button><button class="reader-style-preset" data-reader-action="preset" data-preset="night">夜读</button></div></section>
        <section class="reader-style-block"><h3>页面与文字</h3>
          ${rangeOption('fontSize','正文字号',14,32,1,' px')}
          ${rangeOption('lineHeight','行距',1.35,2.6,0.05,'×',2)}
          ${rangeOption('paragraphGap','段落间距',0.2,2.5,0.1,' em',1)}
          ${rangeOption('letterSpacing','字间距',-0.02,0.12,0.005,' em',3)}
          ${rangeOption('marginX','左右页边距',4,40,1,' px')}
          ${rangeOption('padTop','上边距',4,64,1,' px')}
          ${rangeOption('padBottom','下边距',4,64,1,' px')}
          ${rangeOption('mainWidth','正文最大宽度',320,680,10,' px')}
          ${selectOption('fontFamily','字体风格',[['serif','宋体 / 衬线'],['sans','黑体 / 无衬线']])}
          ${selectOption('textAlign','文字对齐',[['justify','两端对齐'],['left','左对齐'],['center','居中']])}
          ${selectOption('verticalAlign','短页垂直位置',[['flex-start','顶部开始'],['center','垂直居中'],['space-evenly','均匀铺满'],['space-between','上下分散']])}
          ${selectOption('turnDuration','翻页动画',[['0','关闭'],['0.22','轻快'],['0.3','标准'],['0.55','舒缓']])}
          ${selectOption('turnEffect','翻页效果',[['curl','仿真翻页'],['slide','平移滑动']])}
          ${selectOption('hideDelay','菜单延迟隐藏',[['1.5','1.5 秒'],['2.5','2.5 秒'],['3.2','3.2 秒'],['5','5 秒'],['8','8 秒']])}
          <section class="reader-style-block"><h3>菜单隐藏时显示的页角信息</h3>${selectOption('cornerTL','左上角',[['none','不显示'],['page','页码'],['progress','进度'],['clock','当前时间'],['elapsed','本次阅读时长']])}${selectOption('cornerTR','右上角',[['none','不显示'],['page','页码'],['progress','进度'],['clock','当前时间'],['elapsed','本次阅读时长']])}${selectOption('cornerBL','左下角',[['none','不显示'],['page','页码'],['progress','进度'],['clock','当前时间'],['elapsed','本次阅读时长']])}${selectOption('cornerBR','右下角',[['none','不显示'],['page','页码'],['progress','进度'],['clock','当前时间'],['elapsed','本次阅读时长']])}</section>
          <label class="reader-style-toggle"><span>自动隐藏阅读工具栏</span><input type="checkbox" data-reader-pref="autoHide" ${p.autoHide ? 'checked' : ''}></label>
        </section>
        <section class="reader-style-block"><h3>阅读页面配色</h3>
          ${selectOption('colorMode','纸张主题',[['paper','纸白'],['sepia','暖黄'],['night','夜读'],['custom','自定义颜色']])}
          <div class="reader-style-colors">${colorOption('bg','页面背景',p.bg)}${colorOption('text','正文颜色',p.text)}${colorOption('accent','强调色',p.accent)}</div>
        </section>
      </div>
      <footer class="reader-style-footer"><button data-reader-action="reset-style">恢复默认</button><button class="primary" data-reader-action="close-style">完成</button></footer>
    </section></div>`;
  }
  function openEditor() {
    if (document.querySelector('.reader-style-overlay')) return;
    document.body.insertAdjacentHTML('beforeend', editorHtml());
    document.body.style.overflow = 'hidden';
  }
  function closeEditor() {
    const overlay = document.querySelector('.reader-style-overlay'); if (overlay) overlay.remove();
    document.body.style.overflow = state.screen === 'reader' ? 'hidden' : '';
  }
  function updateEditorValues() {
    const overlay = document.querySelector('.reader-style-overlay'); if (!overlay) return;
    const p = prefs();
    for (const input of overlay.querySelectorAll('[data-reader-pref]')) {
      const key = input.dataset.readerPref;
      if (input.type === 'checkbox') input.checked = !!p[key];
      else input.value = p[key];
    }
    for (const out of overlay.querySelectorAll('[data-reader-value]')) {
      const key = out.dataset.readerValue, value = Number(p[key]);
      const unit = key === 'fontSize' || key === 'marginX' || key === 'padTop' || key === 'padBottom' || key === 'mainWidth' ? ' px' : key === 'paragraphGap' || key === 'letterSpacing' ? ' em' : '×';
      out.textContent = `${key === 'lineHeight' || key === 'paragraphGap' || key === 'letterSpacing' ? value.toFixed(key === 'letterSpacing' ? 3 : 2) : value}${unit}`;
    }
  }
  function applyPreset(name) {
    if (!PRESETS[name]) return;
    const p = prefs(); Object.assign(p, PRESETS[name]);
    p.bg = PALETTES[p.colorMode].bg; p.text = PALETTES[p.colorMode].text; p.accent = PALETTES[p.colorMode].accent;
    state.readerMode = p.colorMode; state.font = p.fontSize;
    persistPrefs(); applyPrefs(); updateEditorValues(); reflow(100);
  }
  function setTheme(mode) {
    const p = prefs(); p.colorMode = mode;
    if (mode !== 'custom') {
      const palette = PALETTES[mode]; p.bg = palette.bg; p.text = palette.text; p.accent = palette.accent;
      state.readerMode = mode;
    } else state.readerMode = 'paper';
    persistPrefs(); applyPrefs(); updateEditorValues(); reflow(100);
  }
  let rangeCommitTimer = null;
  function updatePref(input) {
    const p = prefs(), key = input.dataset.readerPref;
    let value;
    if (input.type === 'checkbox') value = input.checked;
    else if (input.type === 'color') value = validColor(input.value, p[key]);
    else if (input.tagName === 'SELECT') value = input.value;
    else value = Number(input.value);
    p[key] = value;
    if (['bg', 'text', 'accent'].includes(key)) p.colorMode = 'custom';
    if (key === 'colorMode') {
      if (value === 'custom') state.readerMode = 'paper';
      else { const palette = PALETTES[value]; p.bg = palette.bg; p.text = palette.text; p.accent = palette.accent; state.readerMode = value; }
    }
    if (key === 'autoHide' && value === false) { const screen = document.querySelector('.reader-screen'); if (screen) screen.classList.remove('controls-hidden', 'controls-faded'); if (controlsTimer) clearTimeout(controlsTimer); controlsTimer = null; }
    if (key === 'autoHide' && value === true && state.screen === 'reader') scheduleReaderControls();
    if (key === 'hideDelay' && state.screen === 'reader' && prefs().autoHide) scheduleReaderControls();
    if (key === 'fontSize') state.font = p.fontSize;
    persistPrefs(); applyPrefs(); updateEditorValues();
    if (input.type !== 'range' && ['fontSize','lineHeight','paragraphGap','letterSpacing','marginX','padTop','padBottom','mainWidth','fontFamily','textAlign','verticalAlign','cornerTL','cornerTR','cornerBL','cornerBR'].includes(key)) reflow(150);
  }
  function commitRangeChange() {
    if (rangeCommitTimer) clearTimeout(rangeCommitTimer);
    rangeCommitTimer = setTimeout(() => { rangeCommitTimer = null; if (state.screen === 'reader' && document.querySelector('.reader-style-overlay')) reflow(140); }, 90);
  }

  const originalHandleAction = handleAction;
  handleAction = function (action, el) {
    if (action === 'reader-mode') {
      const modes = ['paper', 'sepia', 'night', 'custom'];
      const current = prefs().colorMode, next = modes[(modes.indexOf(current) + 1) % modes.length];
      setTheme(next); if (typeof toast === 'function') toast(next === 'custom' ? '自定义阅读配色' : next === 'night' ? '夜读主题' : next === 'sepia' ? '暖黄主题' : '纸白主题');
      render(); return;
    }
    if (action === 'font-up' || action === 'font-down') {
      const p = prefs(); p.fontSize = clamp(p.fontSize + (action === 'font-up' ? 1 : -1), 14, 32, DEFAULTS.fontSize);
      state.font = p.fontSize; persistPrefs(); applyPrefs(); reflow(120);
      if (typeof toast === 'function') toast(`字号 ${p.fontSize}px`); return;
    }
    if (originalHandleAction) return originalHandleAction(action, el);
  };

  function currentBookmark() {
    const book = getBook(); if (!book) return null;
    const fraction = readerPageCount > 1 ? readerPageIndex / (readerPageCount - 1) : 0;
    const id = `${book.id}:p${Math.round(fraction * 10000)}`;
    return { id, bookId: book.id, bookTitle: book.title, pageIndex: readerPageIndex, pageCount: readerPageCount, fraction, progress: book.progress || 0, snippet: (document.querySelectorAll('.reader-page')[readerPageIndex]?.innerText || '').trim().slice(0, 180), updatedAt: Date.now() };
  }
  function isCurrentBookmarked() { const item = currentBookmark(); return !!item && readBookmarks().some(b => b.id === item.id); }
  function updateBookmarkButton() {
    const button = document.querySelector('[data-reader-action="toggle-bookmark"]'); if (!button) return;
    const active = isCurrentBookmarked(); button.setAttribute('aria-label', active ? '移除当前页书签' : '收藏当前页'); button.title = active ? '已收藏此页' : '收藏当前页'; button.classList.toggle('bookmarked', active);
  }
  function toggleBookmark() {
    if (state.screen !== 'reader') return;
    const item = currentBookmark(); if (!item) return;
    const list = readBookmarks(), index = list.findIndex(b => b.id === item.id), deleted = readDeletedBookmarks();
    if (index >= 0) {
      list.splice(index, 1); if (!deleted.includes(item.id)) deleted.push(item.id); localStorage.setItem(deletedBookmarksKey, JSON.stringify(deleted)); persistBookmarks(list); toast('已移除书签');
    } else {
      item.updatedAt = Date.now(); list.push(item); localStorage.setItem(deletedBookmarksKey, JSON.stringify(deleted.filter(id => id !== item.id))); persistBookmarks(list); toast('已保存当前页书签');
    }
    updateBookmarkButton();
  }
  function mountReaderTools() {
    const screen=document.querySelector('.reader-screen');if(!screen)return;
    const book=getBook();if(!book)return;
    const glyph={back:'<path d="m15 18-6-6 6-6"/>',toc:'<path d="M8 6h12M8 12h12M8 18h12"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',share:'<path d="M12 16V4m-4 4 4-4 4 4"/><path d="M5 13v6h14v-6"/>',more:'<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',bookmark:'<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4z"/>',note:'<path d="M4 4h16v13H8l-4 3z"/><path d="M8 8h8M8 12h6"/>',progress:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',theme:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',list:'<path d="M5 6h14M5 12h14M5 18h14"/><path d="M2 6h.01M2 12h.01M2 18h.01"/>'};
    const svg=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${glyph[name]||''}</svg>`;
    const header=screen.querySelector('.reader-top');
    if(header){let chapter=(book.format||'本地文本');if(Array.isArray(book.toc)){for(const item of book.toc){if(Number(item.offset)<=(readerPageOffsets[readerPageIndex]||0))chapter=String(item.title||chapter);else break}}header.innerHTML=`<button class="reader-top-icon" data-action="back" aria-label="返回">${svg('back')}</button><div class="reader-top-title" title="${html(book.title)}">${html(book.title)}</div><span class="reader-chapter">${html(chapter)}</span><span class="reader-page-top" id="readerPageTop">${readerPageIndex+1} / ${readerPageCount}</span><button class="reader-top-icon" data-reader-action="open-toc" aria-label="目录" title="目录">${svg('list')}</button><button class="reader-top-icon" data-action="reader-share" aria-label="分享" title="分享">${svg('share')}</button><button class="reader-top-icon ${isCurrentBookmarked()?'bookmarked':''}" data-reader-action="toggle-bookmark" aria-label="收藏当前页" title="收藏当前页">${svg('bookmark')}</button><button class="reader-top-icon" data-reader-action="open-reader-menu" aria-label="更多" title="更多">${svg('more')}</button>`;}
    const dock=screen.querySelector('.reader-dock');if(dock){dock.innerHTML=`<div class="reader-toolbar"><div class="reader-bottom-tools"><button class="reader-bottom-item" data-reader-action="open-toc" aria-label="目录"><span class="reader-bottom-symbol">${svg('toc')}</span><span>目录</span></button><button class="reader-bottom-item" data-action="make-note" aria-label="记笔记"><span class="reader-bottom-symbol">${svg('note')}</span><span>摘录</span></button><button class="reader-bottom-item" data-reader-action="open-progress" aria-label="阅读进度"><span class="reader-bottom-symbol">${svg('progress')}</span><span>进度</span></button><button class="reader-bottom-item" data-reader-action="open-theme" aria-label="阅读主题"><span class="reader-bottom-symbol">${svg('theme')}</span><span>主题</span></button><button class="reader-bottom-item" data-reader-action="open-style" aria-label="文字设置"><span class="reader-bottom-symbol text-symbol">A</span><span>文字</span></button></div></div>`;}
    let fab=screen.querySelector('.reader-tts-fab');if(!fab){fab=document.createElement('button');fab.className='reader-tts-fab';fab.dataset.action='tts';fab.setAttribute('aria-label','语音朗读');screen.appendChild(fab)}fab.textContent=state.tts?'Ⅱ':'听';fab.setAttribute('aria-label',state.tts?'停止朗读':'开始朗读');
    updateBookmarkButton();ensureCornerInfo(screen);
  }

  function closeReaderPanel(){const panel=document.querySelector('.reader-panel-overlay');if(panel)panel.remove();document.body.style.overflow=state.screen==='reader'?'hidden':'';document.body.classList.remove('ime-visible');return !!panel;}
  function openReaderPanel(title,bodyHtml){closeReaderPanel();const overlay=document.createElement('div');overlay.className='reader-panel-overlay';overlay.innerHTML=`<section class="reader-panel-sheet" role="dialog" aria-modal="true"><div class="reader-sheet-handle"></div><header class="reader-panel-head"><h2>${html(title)}</h2><button data-reader-action="close-panel" aria-label="关闭">×</button></header>${bodyHtml}</section>`;document.body.appendChild(overlay);document.body.style.overflow='hidden';updateVisualViewport();}
  function buildReaderToc(book){let entries=Array.isArray(book.toc)?book.toc.map(x=>({title:String(x&&x.title||''),offset:Number(x&&x.offset)})).filter(x=>x.title&&Number.isFinite(x.offset)&&x.offset>=0):[];if(!entries.length){const text=String(book.content||''),rx=/(?:^|\n)\s*((?:第[一二三四五六七八九十百千万零〇两\d]+[章节回集部卷篇][^\n]{0,48})|(?:序章|楔子|引子|前言|后记|结语|尾声|Chapter\s+\d+[^\n]{0,48}))\s*(?=\n|$)/gi;for(const m of text.matchAll(rx)){const title=m[1].trim();entries.push({title,offset:m.index+m[0].indexOf(m[1])});if(entries.length>=500)break}if(entries.length)book.toc=entries;else entries=[{title:'正文开篇',offset:0}];if(entries.length&&typeof save==='function')save()}return entries.sort((a,b)=>a.offset-b.offset);}
  function pageAtOffset(offset){let lo=0,hi=Math.max(0,readerPageOffsets.length-1);while(lo<hi){const mid=Math.ceil((lo+hi)/2);if((readerPageOffsets[mid]||0)<=offset)lo=mid;else hi=mid-1}return lo;}
  function openToc(){const book=getBook();if(!book)return;const entries=buildReaderToc(book),currentOffset=readerPageOffsets[readerPageIndex]||0,htmlRows=entries.map((item,i)=>{const page=pageAtOffset(item.offset),current=item.offset<=currentOffset&&(i===entries.length-1||entries[i+1].offset>currentOffset);return `<button class="reader-toc-row${current?' current':''}" data-reader-action="goto-toc" data-offset="${item.offset}"><span>${html(item.title)}</span><small>第 ${page+1} 页</small></button>`}).join('');openReaderPanel(`目录 · ${entries.length} 项`,`<div class="reader-panel-scroll">${htmlRows}</div>`);}
  function openProgress(){const book=getBook();if(!book)return;const progress=book.progress||0,minutes=Math.floor((book.minutes||0)),notes=state.notes.filter(n=>n.bookId===book.id).length;openReaderPanel('阅读进度',`<div class="reader-panel-scroll"><div class="reader-progress-stats"><div><strong>${progress}%</strong><span>阅读进度</span></div><div><strong>${minutes}</strong><span>阅读分钟</span></div><div><strong>${notes}</strong><span>摘录与笔记</span></div></div><p class="reader-panel-hint">拖动定位到指定页。纵向滑动此面板可以继续浏览设置，不会翻动正文。</p><input class="reader-page-range" id="readerPageRange" type="range" min="0" max="${Math.max(1,readerPageCount-1)}" value="${readerPageIndex}" aria-label="跳转页码"><div class="reader-panel-actions"><button class="reader-panel-action" data-reader-action="jump-reader-start">回到开篇</button><button class="reader-panel-action" data-reader-action="jump-reader-current">回到当前页</button></div></div>`);}
  function openThemePanel(){const mode=prefs().colorMode;openReaderPanel('页面主题',`<div class="reader-panel-scroll"><p class="reader-panel-hint">主题只改变纸张与文字颜色，不会移动当前阅读位置。</p><div class="reader-theme-options">${[['paper','纸白'],['sepia','暖黄'],['night','夜读']].map(([key,label])=>`<button class="reader-theme-option${mode===key?' active':''}" data-reader-action="set-theme" data-theme="${key}">${label}</button>`).join('')}</div><button class="reader-panel-action" style="width:100%" data-reader-action="open-style">更多颜色设置</button></div>`);}
  function openReaderMenu(){const book=getBook();if(!book)return;openReaderPanel('更多操作',`<div class="reader-more-list"><button data-reader-action="reader-book-detail" data-book-id="${html(book.id)}">书籍详情与阅读数据　›</button><button data-reader-action="reader-mark-read">标记为已读　›</button><button data-reader-action="reader-toggle-bookmark">${isCurrentBookmarked()?'移除当前页书签':'收藏当前页'}　›</button><button data-reader-action="reader-share">分享书籍文字　›</button></div>`);}
  function updateVisualViewport(){const vv=window.visualViewport,root=document.documentElement,height=vv&&vv.height?vv.height:window.innerHeight,top=vv&&Number.isFinite(vv.offsetTop)?vv.offsetTop:0;root.style.setProperty('--app-visual-height',`${Math.max(180,Math.round(height))}px`);root.style.setProperty('--app-visual-top',`${Math.max(0,Math.round(top))}px`);const gap=Math.max(0,window.innerHeight-height-top);document.body.classList.toggle('ime-visible',gap>110);}
  window.paperIsleCloseTopPanel=()=>{if(closeReaderPanel())return true;if(document.querySelector('.reader-style-overlay')){closeEditor();return true}return false;};

  function mountSettingsRow() {
    const main = document.querySelector('main.screen-in'); if (!main || main.querySelector('[data-reader-action="open-style"]')) return;
    const section = document.createElement('section'); section.innerHTML = `<div class="settings-section-label">阅读外观</div><div class="settings-group"><button class="setting-row" data-reader-action="open-style"><span><div class="setting-name">自定义阅读页面</div><div class="setting-desc">字体、留白、行距、对齐、背景与工具栏</div></span><span class="setting-value">${prefs().fontSize}px　›</span></button></div>`;
    const heading = main.querySelector('.page-heading'); if (heading) heading.insertAdjacentElement('afterend', section); else main.prepend(section);
  }
  function renderBookmarkList() {
    const main = document.querySelector('main.screen-in'); if (!main) return;
    const previous = main.querySelector('.reader-bookmarks-section'); if (previous) previous.remove();
    const items = readBookmarks().filter(b => state.books.some(book => book.id === b.bookId)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const section = document.createElement('section'); section.className = 'reader-bookmarks-section';
    const cards = items.length ? items.map(item => `<article class="note-card reader-bookmark-card"><div class="note-accent" style="background:var(--gold)"></div><div class="note-meta"><span>《${html(item.bookTitle)}》</span><span>第 ${Number(item.pageIndex) + 1} / ${Number(item.pageCount) || 1} 页</span></div><p class="reader-bookmark-snippet">${html(item.snippet || '（本页无可预览文字）')}</p><div class="note-actions"><button class="link-action" data-reader-action="open-bookmark" data-bookmark-id="${html(item.id)}">跳转到此页</button><button class="link-action" data-reader-action="remove-bookmark" data-bookmark-id="${html(item.id)}">删除书签</button></div></article>`).join('') : `<div class="empty-state" style="margin-top:8px">暂时没有书签。阅读时点底部 ☆ 可收藏当前页。</div>`;
    section.innerHTML = `<div class="settings-section-label">页内书签 · ${items.length}</div>${cards}`;
    const first = main.querySelector('.note-card,.empty-state,.page-footer'); if (first) first.insertAdjacentElement('beforebegin', section); else main.appendChild(section);
  }
  function openBookmark(id) {
    const item = readBookmarks().find(b => b.id === id); if (!item) return;
    const book = state.books.find(b => b.id === item.bookId); if (!book) { toast('这本书已不在书架'); return; }
    const fraction = clamp(item.fraction, 0, 1, 0); book.progress = Math.round(fraction * 100); if (book.status === '待读') book.status = '在读';
    book.updatedAt = Date.now(); if(state.screen!=='reader')state.readerReturnScreen=state.screen; state.bookId = book.id; state.screen = 'reader'; state.tts = false;
    if (typeof save === 'function') save(); render();
    setTimeout(() => { if (state.screen === 'reader') setReaderPage(Math.round(fraction * Math.max(0, readerPageCount - 1)), true, true); }, 360);
  }
  function removeBookmark(id) {
    const items = readBookmarks(), remaining = items.filter(b => b.id !== id);
    if (items.length === remaining.length) return;
    persistBookmarks(remaining); const deleted = readDeletedBookmarks(); if (!deleted.includes(id)) deleted.push(id); localStorage.setItem(deletedBookmarksKey, JSON.stringify(deleted));
    renderBookmarkList(); toast('书签已删除');
  }

  let readerWasActive=false;
  const baseSetReaderPage=setReaderPage;
  setReaderPage=function(...args){const result=baseSetReaderPage(...args);updateCornerInfo();const star=document.querySelector('.reader-top [data-reader-action=toggle-bookmark]');if(star){star.classList.toggle('bookmarked',isCurrentBookmarked());star.setAttribute('aria-label',isCurrentBookmarked()?'移除当前页书签':'收藏当前页')}return result;};
  const originalRender = render;
  render = function () {
    originalRender();
    const readerActiveNow=state.screen==='reader'; if(readerActiveNow&&!readerWasActive) readerSessionStartedAt=Date.now(); readerWasActive=readerActiveNow;
    applyPrefs();
    if (state.screen === 'reader') {
      mountReaderTools(); attachResizeObserver(); reflow(180);
    } else if (state.screen === 'settings') mountSettingsRow();
    else if (state.screen === 'notes') renderBookmarkList();
  };
  document.addEventListener('click', event => {
    const button=event.target.closest('[data-reader-action]');
    if(button){const action=button.dataset.readerAction;const routed=['open-style','close-style','reset-style','preset','toggle-bookmark','open-bookmark','remove-bookmark','open-toc','goto-toc','open-progress','open-theme','set-theme','open-reader-menu','close-panel','jump-reader-start','jump-reader-current','reader-book-detail','reader-mark-read','reader-toggle-bookmark','reader-share'];if(routed.includes(action)){event.preventDefault();event.stopImmediatePropagation();if(action==='open-style'){closeReaderPanel();openEditor()}else if(action==='close-style')closeEditor();else if(action==='reset-style')applyPreset('balanced');else if(action==='preset')applyPreset(button.dataset.preset);else if(action==='toggle-bookmark'||action==='reader-toggle-bookmark')toggleBookmark();else if(action==='open-bookmark')openBookmark(button.dataset.bookmarkId);else if(action==='remove-bookmark')removeBookmark(button.dataset.bookmarkId);else if(action==='open-toc')openToc();else if(action==='goto-toc'){const offset=Math.max(0,Number(button.dataset.offset)||0);closeReaderPanel();setReaderPage(pageAtOffset(offset),true)}else if(action==='open-progress')openProgress();else if(action==='open-theme')openThemePanel();else if(action==='set-theme'){setTheme(button.dataset.theme);closeReaderPanel()}else if(action==='open-reader-menu')openReaderMenu();else if(action==='close-panel')closeReaderPanel();else if(action==='jump-reader-start'){closeReaderPanel();setReaderPage(0,true)}else if(action==='jump-reader-current')closeReaderPanel();else if(action==='reader-book-detail'){const target={dataset:{bookId:button.dataset.bookId}};closeReaderPanel();handleAction('book-details',target)}else if(action==='reader-mark-read'){closeReaderPanel();handleAction('mark-read',button)}else if(action==='reader-share'){closeReaderPanel();handleAction('reader-share',button)}return}}
    if(event.target.classList.contains('reader-style-overlay')){event.preventDefault();event.stopImmediatePropagation();closeEditor();return}
    if(event.target.classList.contains('reader-panel-overlay')){event.preventDefault();event.stopImmediatePropagation();closeReaderPanel()}
  },true);
  document.addEventListener('input',event=>{const range=event.target;if(range&&range.id==='readerPageRange'){event.stopImmediatePropagation();setReaderPage(Math.round(Number(range.value)||0),false);return}const input=event.target.closest('[data-reader-pref]');if(!input)return;updatePref(input)},true);
  document.addEventListener('change',event=>{const target=event.target;if(target&&target.id==='readerPageRange'){event.stopImmediatePropagation();setReaderPage(Math.round(Number(target.value)||0),true);return}if(target&&target.matches('.reader-style-control input[type="range"][data-reader-pref]')){event.stopImmediatePropagation();commitRangeChange()}},true);
  document.addEventListener('pointerup',event=>{if(event.target&&event.target.matches('.reader-style-control input[type="range"][data-reader-pref]'))commitRangeChange()},true);
  document.addEventListener('touchend',event=>{if(event.target&&event.target.matches('.reader-style-control input[type="range"][data-reader-pref]'))commitRangeChange()},true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.querySelector('.reader-style-overlay')){event.preventDefault();event.stopImmediatePropagation();closeEditor()}},true);
  document.addEventListener('focusin',event=>{const target=event.target;if(target&&target.matches('input:not([type="range"]),textarea,select'))setTimeout(()=>{updateVisualViewport();target.scrollIntoView({block:'nearest',behavior:'smooth'})},140)});
  document.addEventListener('focusout',()=>setTimeout(updateVisualViewport,180));
  window.addEventListener('resize',updateVisualViewport);if(window.visualViewport){window.visualViewport.addEventListener('resize',updateVisualViewport);window.visualViewport.addEventListener('scroll',updateVisualViewport)}updateVisualViewport();
  window.addEventListener('resize', () => { if (state.screen === 'reader') reflow(220); });
  document.addEventListener('transitionend', event => {
    if (state.screen === 'reader' && event.target.closest('.reader-screen') && ['height', 'max-height', 'padding', 'flex-basis'].includes(event.propertyName)) reflow(100);
  });
  render();
})();
