(() => {
  'use strict';
  const baseSave = save;
  const baseRender = render;
  const baseSettings = settingsScreen;
  const baseHandle = handleAction;
  const baseSetReaderPage = setReaderPage;
  const baseReceiveImported = window.receiveImportedFile;
  const basePaperIsleBack = window.paperIsleBack;
  const callbacks = new Map();
  let onlineSession = 0;

  const escHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const randomId = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).slice(2,9)}`);
  const modal = (title, sub, content) => { const back=document.createElement('div');back.className='modal-backdrop';back.innerHTML=`<section class="modal"><h3>${escHtml(title)}</h3><div class="page-subtitle">${escHtml(sub)}</div>${content}<div class="modal-buttons"><button data-close-modal>取消</button><button class="primary" data-save-modal>保存</button></div></section>`;document.body.appendChild(back);return back; };

  window.onSecretResult = (requestId, value) => { const fn=callbacks.get(requestId); if(fn){callbacks.delete(requestId);fn(value||'');} };
  window.onSecretSaved = (name, ok) => { if(!ok) toast('安全存储失败，请重试'); };
  window.onAudioResult = (requestId, status, mime, data, error) => { const fn=callbacks.get(requestId); if(fn){callbacks.delete(requestId);fn({status:Number(status)||0,mime:String(mime||'audio/mpeg'),data:String(data||''),error:String(error||'')});} };
  window.onSyncResult = (requestId, status, body) => { const fn=callbacks.get(requestId); if(fn){callbacks.delete(requestId);fn({status:Number(status)||0,body:String(body||'')});} };
  window.onOnlineAudioDone = token => { if(Number(token)===onlineSession) playNextOnlineChunk(onlineSession); };
  window.onOnlineAudioError = token => { if(Number(token)===onlineSession){onlineSession++;if(window.Android&&Android.stopOnlineAudio)Android.stopOnlineAudio();state.tts=false;render();toast('在线语音播放失败，请检查网络或服务配置');} };
  window.onOnlineAudioStopped = token => { if(Number(token)===onlineSession){onlineSession++;state.tts=false;render();} };

  function promiseCall(register, timeoutMs=90000){
    const requestId=randomId();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{callbacks.delete(requestId);reject(new Error('在线服务响应超时'));},timeoutMs);
      callbacks.set(requestId,result=>{clearTimeout(timer);resolve(result);});
      try{register(requestId);}catch(e){clearTimeout(timer);callbacks.delete(requestId);reject(e);}
    });
  }
  const getSecret = name => promiseCall(id=>{if(!window.Android||!Android.getSecret)throw new Error('请在安卓应用中配置安全密钥');Android.getSecret(name,id);},7000);
  const audioRequest = (url,headers,body) => promiseCall(id=>{if(!window.Android||!Android.requestAudio)throw new Error('请在安卓应用内使用在线语音');Android.requestAudio(url,JSON.stringify(headers||{}),body||'',id);},120000);
  const syncRequest = (method,url,user,password,body='') => promiseCall(id=>{if(!window.Android)throw new Error('请在安卓应用内使用 WebDAV 同步');if(method==='GET')Android.webDavGet(url,user,password,id);else Android.webDavPut(url,user,password,body,id);},120000);
  function validateHttps(value,label){try{const u=new URL(value);if(u.protocol!=='https:')throw 0;return u.href;}catch(_){throw new Error(`${label} 必须是有效的 HTTPS 地址`);}}

  function ttsSettings(){
    const cfg=state.ttsConfig||{};
    const back=modal('语音朗读设置','离线系统朗读无需网络；在线服务使用独立配置的 HTTPS API。',`<label>朗读方式</label><select id="ttsProvider"><option value="system" ${cfg.provider==='system'?'selected':''}>Android 系统离线语音</option><option value="azure" ${cfg.provider==='azure'?'selected':''}>Microsoft Azure Speech</option><option value="custom" ${cfg.provider==='custom'?'selected':''}>自定义 HTTP 音频接口</option></select><div id="azureFields"><label>Azure 区域</label><input id="ttsRegion" value="${escHtml(cfg.region||'japaneast')}" placeholder="japaneast"><label>Azure 语音名</label><input id="ttsVoice" value="${escHtml(cfg.voice||'zh-CN-XiaoxiaoNeural')}" placeholder="zh-CN-XiaoxiaoNeural"><label>Azure Speech Key ${cfg.provider==='azure'&&cfg.hasAzureKey?'（已保存；留空保持不变）':''}</label><input id="azureKey" type="password" autocomplete="off" placeholder="在设备上加密保存">${cfg.hasAzureKey?'<button type="button" class="link-action" id="clearAzureKey">移除 Azure 密钥</button>':''}</div><div id="customFields"><label>自定义 HTTPS 接口</label><input id="customTtsUrl" value="${escHtml(cfg.customUrl||'')}" placeholder="https://你的服务/tts"><label>语音标识（可选）</label><input id="customTtsVoice" value="${escHtml(cfg.voice||'zh-CN-XiaoxiaoNeural')}" placeholder="voice id"><label>自定义 API Token（可选）</label><input id="customTtsKey" type="password" autocomplete="off" placeholder="以 Authorization: Bearer 发送">${cfg.hasCustomKey?'<button type="button" class="link-action" id="clearCustomTtsKey">移除自定义密钥</button>':''}</div><p class="feature-note">自定义接口约定：POST JSON {text, voice, format:"mp3"}，响应为 audio/mpeg 二进制。Azure 密钥由 Android Keystore 加密保存。</p>`);
    const updateVisibility=()=>{const provider=back.querySelector('#ttsProvider').value;back.querySelector('#azureFields').style.display=provider==='azure'?'block':'none';back.querySelector('#customFields').style.display=provider==='custom'?'block':'none';};back.querySelector('#ttsProvider').addEventListener('change',updateVisibility);updateVisibility();back.querySelector('#clearAzureKey')?.addEventListener('click',()=>{if(window.Android&&Android.clearSecret)Android.clearSecret('azure_key');state.ttsConfig.hasAzureKey=false;save();back.remove();render();toast('Azure 密钥已移除');});back.querySelector('#clearCustomTtsKey')?.addEventListener('click',()=>{if(window.Android&&Android.clearSecret)Android.clearSecret('custom_tts_key');state.ttsConfig.hasCustomKey=false;save();back.remove();render();toast('自定义语音密钥已移除');});
    back.addEventListener('click',e=>{
      if(e.target.closest('[data-close-modal]')||e.target===back){back.remove();return;}
      if(!e.target.closest('[data-save-modal]'))return;
      try{const provider=back.querySelector('#ttsProvider').value,region=back.querySelector('#ttsRegion').value.trim().toLowerCase(),voice=back.querySelector('#ttsVoice').value.trim()||'zh-CN-XiaoxiaoNeural',customUrl=back.querySelector('#customTtsUrl').value.trim(),azureKey=back.querySelector('#azureKey').value.trim(),customKey=back.querySelector('#customTtsKey').value.trim();if(provider==='azure'&&(!/^[a-z0-9-]{2,40}$/.test(region)))throw new Error('Azure 区域格式不正确');if(provider==='custom')validateHttps(customUrl,'自定义语音地址');if((azureKey||customKey)&&(!window.Android||!Android.saveSecret))throw new Error('请在安卓应用内安全保存密钥');if(azureKey)Android.saveSecret('azure_key',azureKey);if(customKey)Android.saveSecret('custom_tts_key',customKey);state.ttsConfig={provider,region,voice,customUrl,hasAzureKey:!!azureKey||!!cfg.hasAzureKey,hasCustomKey:!!customKey||!!cfg.hasCustomKey};save();back.remove();render();toast('语音设置已保存');}catch(err){toast(err.message||'配置无效');}
    });
  }
  function syncSettings(){
    const cfg=state.syncConfig||{};
    const back=modal('跨设备同步','通过你自己的 WebDAV 服务同步书籍、阅读进度、笔记、目标、统计、阅读页面样式和书签。请使用私有 HTTPS 地址；服务端目录应预先存在。',`<label>WebDAV JSON 文件完整地址</label><input id="syncUrl" value="${escHtml(cfg.url||'')}" placeholder="https://dav.example.com/remote.php/dav/files/user/paperisle.json"><label>WebDAV 用户名 ${cfg.configured?'（已保存；留空保持不变）':''}</label><input id="syncUser" autocomplete="username" placeholder="用户名"><label>WebDAV 密码 ${cfg.configured?'（已保存；留空保持不变）':''}</label><input id="syncPassword" type="password" autocomplete="new-password" placeholder="密码"><p class="feature-note">同步会上传本地书籍全文、笔记、阅读记录、阅读样式与书签到此地址。密钥使用 Android Keystore 加密保存在设备；服务端必须支持 HTTPS GET/PUT 与 Basic Auth。纸屿不代管你的同步服务器。</p>${cfg.configured?'<button class="link-action" id="clearSyncKeys">清除本机同步凭据</button>':''}`);
    back.addEventListener('click',e=>{
      if(e.target.closest('[data-close-modal]')||e.target===back){back.remove();return;}
      if(e.target.closest('#clearSyncKeys')){if(window.Android&&Android.clearSecret){Android.clearSecret('sync_username');Android.clearSecret('sync_password');}state.syncConfig.configured=false;save();back.remove();render();toast('本机同步凭据已清除');return;}
      if(!e.target.closest('[data-save-modal]'))return;
      try{const url=validateHttps(back.querySelector('#syncUrl').value.trim(),'WebDAV 地址'),user=back.querySelector('#syncUser').value.trim(),password=back.querySelector('#syncPassword').value;if(!cfg.configured&&(!user||!password))throw new Error('首次配置 WebDAV 需要同时填写用户名和密码');if((user||password)&&(!window.Android||!Android.saveSecret))throw new Error('请在安卓应用内安全保存账号凭据');if(user)Android.saveSecret('sync_username',user);if(password)Android.saveSecret('sync_password',password);state.syncConfig={url,configured:!!(user||password||cfg.configured)};save();back.remove();render();toast('WebDAV 设置已保存');}catch(err){toast(err.message||'配置无效');}
    });
  }

  settingsScreen = function(){
    let html=baseSettings();
    const section=`<div class="settings-section-label">在线与跨设备</div><div class="settings-group"><button class="setting-row" data-action="tts-config"><span><div class="setting-name">在线语音</div><div class="setting-desc">系统离线 / Azure / 自定义 HTTP</div></span><span class="setting-value">设置　›</span></button><button class="setting-row" data-action="sync-config"><span><div class="setting-name">同步服务器</div><div class="setting-desc">${state.syncConfig.configured?'WebDAV 已配置':'使用自己的 WebDAV'}</div></span><span class="setting-value">设置　›</span></button><button class="setting-row" data-action="sync-now"><span><div class="setting-name">立即同步</div><div class="setting-desc">同步书籍全文、阅读记录、页面样式与书签</div></span><span class="setting-value">开始　›</span></button></div><div class="feature-note" style="padding:0 4px 12px">在线语音为可选项；未配置时，本地阅读和 Android 离线朗读照常工作。</div>`;
    return html.replace('<div class="settings-section-label">本地书库',section+'<div class="settings-section-label">本地书库');
  };

  function speechChunks(text, limit=480){
    const out=[]; let buffer='';
    for(const ch of String(text||'')){
      buffer+=ch;
      const hard=/[。！？!?；;]/.test(ch);
      const soft=/[，,、：:]/.test(ch)&&buffer.length>=80;
      if(hard||soft){out.push(buffer.trim());buffer='';continue;}
      if(buffer.length>=limit){let cut=buffer.length;for(let i=buffer.length-1;i>Math.max(0,buffer.length-160);i--){if(/[。！？!?；;，,、：:]/.test(buffer[i])){cut=i+1;break;}}out.push(buffer.slice(0,cut).trim());buffer=buffer.slice(cut);}
    }
    if(buffer.trim())out.push(buffer.trim());return out;
  }
  let currentChunks=[],currentChunkPages=[],currentChunkIndex=0,currentSpeechToken=0;
  function stopAllSpeech(){currentSpeechToken++;onlineSession++;currentChunks=[];currentChunkPages=[];currentChunkIndex=0;if(window.Android){if(Android.stopSpeech)Android.stopSpeech();if(Android.stopOnlineAudio)Android.stopOnlineAudio();}if(window.speechSynthesis)speechSynthesis.cancel();state.tts=false;}
  function pageSpeechText(page){
    if(!page)return '';
    const children=Array.from(page.children||[]);let result='';
    if(!children.length)return String(page.innerText||page.textContent||'').replace(/\s+/g,' ').trim();
    for(const node of children){
      if(node.classList&&node.classList.contains('reader-line')){
        const line=String(node.textContent||'').replace(/\s+/g,' ').trim();if(!line)continue;
        if(result&&/[A-Za-z0-9]$/.test(result)&&/^[A-Za-z0-9]/.test(line))result+=' ';
        result+=line;
      }else if(node.classList&&node.classList.contains('reader-paragraph-gap')){
        if(result&&!/\s$/.test(result))result+=' ';
      }else{
        const value=String(node.textContent||'').replace(/\s+/g,' ').trim();if(value){if(result&&!/\s$/.test(result))result+=' ';result+=value;}
      }
    }
    return result.replace(/\s+/g,' ').trim();
  }
  function currentSpeechPages(){
    const pages=Array.from(document.querySelectorAll('.reader-page'));
    if(pages.length){const start=Math.max(0,Math.min(pages.length-1,Number.isFinite(Number(readerPageIndex))?Number(readerPageIndex):0));return pages.slice(start).map((page,i)=>({pageIndex:start+i,text:pageSpeechText(page)}));}
    const book=getBook();return book&&book.content?[{pageIndex:Math.max(0,Number(readerPageIndex)||0),text:String(book.content).replace(/\s+/g,' ').trim()}]:[];
  }
  function currentSpeechText(){return currentSpeechPages().map(item=>item.text).filter(Boolean).join(' ');}
  function speakBrowserPages(entries,index,token,rate){
    if(token!==currentSpeechToken||!state.tts)return;
    if(index>=entries.length){state.tts=false;render();return;}
    const item=entries[index];if(item.text&&typeof setReaderPage==='function')setReaderPage(item.pageIndex,true,false);
    if(!item.text){speakBrowserPages(entries,index+1,token,rate);return;}
    const utterance=new SpeechSynthesisUtterance(item.text);utterance.lang='zh-CN';utterance.rate=rate;
    utterance.onend=()=>speakBrowserPages(entries,index+1,token,rate);
    utterance.onerror=()=>{if(token===currentSpeechToken){state.tts=false;render();toast('这一页语音合成失败，可点朗读重试');}};
    speechSynthesis.speak(utterance);
  }
  async function startOnlineSpeech(){
    const book=getBook(),cfg=state.ttsConfig||{};if(!book)return;
    const entries=currentSpeechPages(),text=entries.map(item=>item.text).filter(Boolean).join(' ');
    if(!text.trim()){toast('当前页没有可朗读的文字');return;}
    if(cfg.provider==='system'){
      onlineSession++;currentSpeechToken=onlineSession;state.tts=true;render();
      if(window.Android&&Android.speakPages)Android.speakPages(JSON.stringify(entries.map(item=>item.text)),entries.length?entries[0].pageIndex:Math.max(0,Number(readerPageIndex)||0));
      else if(window.speechSynthesis){speechSynthesis.cancel();speakBrowserPages(entries,0,currentSpeechToken,state.speed);}
      else if(window.Android&&Android.speakText)Android.speakText(text);
      else{state.tts=false;render();toast('当前设备没有可用的系统语音');}
      return;
    }
    if(cfg.provider==='azure'&&!cfg.hasAzureKey){ttsSettings();return;}
    if(cfg.provider==='custom'&&!cfg.customUrl){ttsSettings();return;}
    currentChunks=[];currentChunkPages=[];currentChunkIndex=0;
    for(const entry of entries){if(!entry.text)continue;for(const chunk of speechChunks(entry.text)){currentChunks.push(chunk);currentChunkPages.push(entry.pageIndex);}}
    onlineSession++;currentSpeechToken=onlineSession;const token=onlineSession;state.tts=true;
    if(window.Android&&Android.ensurePlaybackNotificationPermission)Android.ensurePlaybackNotificationPermission();render();playNextOnlineChunk(token);
  }
  async function playNextOnlineChunk(token){
    if(token!==onlineSession||!state.tts)return;
    if(currentChunkIndex>=currentChunks.length){if(window.Android&&Android.stopOnlineAudio)Android.stopOnlineAudio();state.tts=false;render();return;}
    const chunkIndex=currentChunkIndex++,cfg=state.ttsConfig||{},text=currentChunks[chunkIndex],pageIndex=currentChunkPages[chunkIndex];
    if(Number.isFinite(Number(pageIndex))&&Number(pageIndex)!==Number(readerPageIndex)&&typeof setReaderPage==='function')setReaderPage(Number(pageIndex),true,false);
    try{
      let endpoint,headers={},body;
      if(cfg.provider==='azure'){
        const key=await getSecret('azure_key');if(!key)throw new Error('请重新保存 Azure Speech 密钥');
        endpoint=`https://${cfg.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
        headers={'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3'};
        const safe=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
        body=`<speak version="1.0" xml:lang="zh-CN"><voice name="${escHtml(cfg.voice||'zh-CN-XiaoxiaoNeural')}">${safe}</voice></speak>`;
      }else{
        endpoint=validateHttps(cfg.customUrl,'自定义语音地址');const key=await getSecret('custom_tts_key');headers={'Content-Type':'application/json','Accept':'audio/mpeg'};if(key)headers.Authorization=`Bearer ${key}`;body=JSON.stringify({text,voice:cfg.voice||'zh-CN-XiaoxiaoNeural',format:'mp3'});
      }
      const response=await audioRequest(endpoint,headers,body);if(token!==onlineSession)return;
      if(response.status<200||response.status>=300||!response.data)throw new Error(`语音服务返回 ${response.status}: ${(response.error||'').slice(0,180)}`);
      if(!window.Android||!Android.playOnlineAudio)throw new Error('安卓媒体播放组件未启用');Android.playOnlineAudio(response.data,String(token));
    }catch(err){if(token===onlineSession){state.tts=false;render();toast(err.message||'在线语音请求失败');}}
  }
  window.onNativeSpeechPageStarted=(pageIndex)=>{if(state.screen!=='reader'||!state.tts)return;const index=Number(pageIndex);if(Number.isFinite(index)&&typeof setReaderPage==='function')setReaderPage(index,true,false);};
  window.onNativeTtsStatus = (ready,message) => { state.nativeTtsReady=!!ready; state.nativeTtsMessage=String(message||''); };
  window.onNativeSpeechError = (message,needsSetup=false) => {
    state.tts=false;render();const detail=String(message||'系统语音未能启动。');
    if(needsSetup&&typeof showConfirm==='function')showConfirm('系统朗读未就绪',detail+'\n可以打开 Android 语音数据安装页面，安装中文语音后再试。',()=>{if(window.Android&&Android.openTtsSettings)Android.openTtsSettings();});else toast(detail);
  };
  const deletedBooks=()=>load('pi_deleted_books',[]),deletedNotes=()=>load('pi_deleted_notes',[]);
  function persistDeletedBook(bookId){const a=deletedBooks();if(!a.includes(bookId))a.push(bookId);localStorage.setItem('pi_deleted_books',JSON.stringify(a));}
  function persistDeletedNote(noteId){const a=deletedNotes();if(!a.includes(noteId))a.push(noteId);localStorage.setItem('pi_deleted_notes',JSON.stringify(a));}
  function snapshot(){
    state.notes.forEach((n,i)=>{if(!n.id)n.id=`legacy-${n.bookId||'book'}-${n.date||i}-${i}`;});
    const data={schema:1,updatedAt:Date.now(),books:state.books,notes:state.notes,goal:state.goal,theme:state.theme,layout:state.layout,readerMode:state.readerMode,readerPrefs:state.readerPrefs||load('pi_reader_style',null),bookmarks:load('pi_reader_bookmarks',[]),deletedBookmarks:load('pi_deleted_reader_bookmarks',[]),accent:state.accent,deletedBooks:deletedBooks(),deletedNotes:deletedNotes(),metrics:{}};
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&/^(pi_minutes_|pi_hour_|pi_words_)/.test(key))data.metrics[key]=localStorage.getItem(key);}
    return data;
  }
  function mergeSnapshots(local,remote){
    if(!remote||remote.schema!==1)throw new Error('服务器上的同步文件格式不支持');
    const deletedB=new Set([...(local.deletedBooks||[]),...(remote.deletedBooks||[])]),deletedN=new Set([...(local.deletedNotes||[]),...(remote.deletedNotes||[])]);
    const books=new Map();for(const b of [...(remote.books||[]),...(local.books||[])]){if(!b||!b.id||deletedB.has(b.id))continue;const prior=books.get(b.id);if(!prior){books.set(b.id,b);continue;}const winner=(Number(b.updatedAt)||0)>=(Number(prior.updatedAt)||0)?b:prior;books.set(b.id,{...prior,...winner,minutes:Math.max(Number(prior.minutes)||0,Number(b.minutes)||0)});}
    const notes=new Map();for(const n of [...(remote.notes||[]),...(local.notes||[])]){if(n&&n.id&&!deletedN.has(n.id))notes.set(n.id,notes.has(n.id)?(Number(n.createdAt)||0)>=(Number(notes.get(n.id).createdAt)||0)?n:notes.get(n.id):n);}
    const metrics={...(remote.metrics||{})};for(const [key,val] of Object.entries(local.metrics||{})){if(/^pi_(minutes_|hour_|words_)/.test(key)){const a=Number(JSON.parse(metrics[key]||'0'))||0,b=Number(JSON.parse(val||'0'))||0;metrics[key]=JSON.stringify(Math.max(a,b));}else metrics[key]=val;}
    const deletedM=new Set([...(local.deletedBookmarks||[]),...(remote.deletedBookmarks||[])]),bookmarks=new Map();for(const mark of [...(remote.bookmarks||[]),...(local.bookmarks||[])]){if(!mark||!mark.id||deletedM.has(mark.id))continue;const prior=bookmarks.get(mark.id);if(!prior||(Number(mark.updatedAt)||0)>=(Number(prior.updatedAt)||0))bookmarks.set(mark.id,mark);}
    const lp=local.readerPrefs,rp=remote.readerPrefs,readerPrefs=!rp?lp:!lp?rp:(Number(lp.updatedAt)||0)>=(Number(rp.updatedAt)||0)?lp:rp;
    return {...local,updatedAt:Date.now(),books:[...books.values()],notes:[...notes.values()],goal:(Number(local.goal&&local.goal.updatedAt)||0)>=(Number(remote.goal&&remote.goal.updatedAt)||0)?local.goal:remote.goal,theme:local.theme||remote.theme,layout:local.layout||remote.layout,readerMode:local.readerMode||remote.readerMode,readerPrefs,bookmarks:[...bookmarks.values()],deletedBookmarks:[...deletedM],accent:local.accent||remote.accent,deletedBooks:[...deletedB],deletedNotes:[...deletedN],metrics};
  }
  async function syncNow(){
    const cfg=state.syncConfig||{};if(!cfg.url||!cfg.configured){syncSettings();return;}
    try{
      const url=validateHttps(cfg.url,'WebDAV 地址'),username=await getSecret('sync_username'),password=await getSecret('sync_password');if(!username&&!password)throw new Error('缺少 WebDAV 凭据，请重新保存');
      toast('正在读取同步数据…');const get=await syncRequest('GET',url,username,password);
      let remote=null;if(get.status===404||get.status===204)remote=null;else if(get.status>=200&&get.status<300){try{remote=JSON.parse(get.body);}catch(_){throw new Error('WebDAV 文件不是有效的 JSON 同步文件');}}else throw new Error(`WebDAV 读取失败（${get.status}）：${get.body.slice(0,150)}`);
      const merged=remote?mergeSnapshots(snapshot(),remote):snapshot();
      const put=await syncRequest('PUT',url,username,password,JSON.stringify(merged));if(put.status<200||put.status>=300)throw new Error(`WebDAV 写入失败（${put.status}）：${put.body.slice(0,150)}`);
      state.books=merged.books||[];state.notes=merged.notes||[];state.goal={minutes:30,year:24,words:3000,...(merged.goal||{})};state.theme=merged.theme||'light';state.layout=merged.layout||'grid';state.readerMode=merged.readerMode||'paper';state.readerPrefs=merged.readerPrefs||state.readerPrefs;state.accent=merged.accent||'sage';
      localStorage.setItem('pi_reader_style',JSON.stringify(state.readerPrefs));localStorage.setItem('pi_reader_bookmarks',JSON.stringify(merged.bookmarks||[]));localStorage.setItem('pi_deleted_reader_bookmarks',JSON.stringify(merged.deletedBookmarks||[]));localStorage.setItem('pi_deleted_books',JSON.stringify(merged.deletedBooks||[]));localStorage.setItem('pi_deleted_notes',JSON.stringify(merged.deletedNotes||[]));for(const [key,value] of Object.entries(merged.metrics||{}))localStorage.setItem(key,value);save();render();toast('同步完成');
    }catch(err){toast(err.message||'同步失败');}
  }

  settingsScreen=function(){
    let html=baseSettings();html=html.replace('仅保存在这台设备，不上传','默认保存在本机；同步只发往你配置的 WebDAV');const section=`<div class="settings-section-label">在线与跨设备</div><div class="settings-group"><button class="setting-row" data-action="tts-config"><span><div class="setting-name">在线语音</div><div class="setting-desc">系统离线 / Azure / 自定义 HTTP</div></span><span class="setting-value">${state.ttsConfig.provider==='system'?'离线':state.ttsConfig.provider==='azure'?'Azure':'HTTP'}　›</span></button><button class="setting-row" data-action="sync-config"><span><div class="setting-name">同步服务器</div><div class="setting-desc">${state.syncConfig.configured?'WebDAV 已配置':'使用自己的 WebDAV'}</div></span><span class="setting-value">设置　›</span></button><button class="setting-row" data-action="sync-now"><span><div class="setting-name">立即同步</div><div class="setting-desc">同步书籍全文、阅读记录、页面样式与书签</div></span><span class="setting-value">开始　›</span></button></div><div class="feature-note" style="padding:0 4px 12px">在线服务可选；未配置时，本地阅读和 Android 离线朗读照常工作。</div>`;
    return html.replace('<div class="settings-section-label">本地书库',section+'<div class="settings-section-label">本地书库');
  };
  save=function(){baseSave();localStorage.setItem('pi_tts_config',JSON.stringify(state.ttsConfig));localStorage.setItem('pi_sync_config',JSON.stringify(state.syncConfig));};
  let lastNativeReaderState=null;
  render=function(){baseRender();document.body.dataset.accent=state.accent;const active=state.screen==='reader';if(active!==lastNativeReaderState){lastNativeReaderState=active;if(window.Android&&Android.setReaderActive)Android.setReaderActive(active);}};

  window.receiveImportedFile=function(title,content,author,format,coverData='',metadata={},silent=false){if(baseReceiveImported)baseReceiveImported(title,content,author,format,coverData,metadata,silent);const book=state.books.find(b=>b.title===title&&b.format===format)||state.books[state.books.length-1];if(book)book.updatedAt=Date.now();save();};
  setReaderPage=function(index,persist=true,preserveProgress=false){const book=getBook();baseSetReaderPage(index,persist,preserveProgress);if(book&&persist){book.updatedAt=Date.now();save();}};
  handleAction=function(action,el){
    if(action==='tts-config'){ttsSettings();return;}
    if(action==='sync-config'){syncSettings();return;}
    if(action==='sync-now'){syncNow();return;}
    if(action==='tts'){
      if(state.tts){stopAllSpeech();render();return;}
      startOnlineSpeech();return;
    }
    if(action==='back'){stopAllSpeech();return baseHandle(action,el);}
    if(action==='delete-book'){
      const book=state.books.find(b=>b.id===(el&&el.dataset.bookId));if(!book)return;
      showConfirm('从书架移除这本书？','《'+book.title+'》及其笔记会一并移除并同步记录。',()=>{persistDeletedBook(book.id);state.books=state.books.filter(x=>x.id!==book.id);state.notes=state.notes.filter(x=>x.bookId!==book.id);save();render();toast('已从书架移除')});return;
    }
    if(action==='daily-goal'||action==='year-goal'||action==='words-goal'){baseHandle(action,el);state.goal.updatedAt=Date.now();save();return;}
    if(action==='mark-read'){const book=getBook();if(book)book.updatedAt=Date.now();baseHandle(action,el);return;}
    baseHandle(action,el);
  };

  app.addEventListener('click',e=>{
    const del=e.target.closest('[data-delete-note]');if(del){e.stopImmediatePropagation();const index=Number(del.dataset.deleteNote),note=state.notes[index];if(!note)return;showConfirm('删除这条笔记？','删除后无法恢复，并会在下次同步时传递此更改。',()=>{persistDeletedNote(note.id);state.notes.splice(index,1);save();render();toast('笔记已删除')});}
  },true);
  window.paperIsleBack=function(){if(state.screen==='reader')stopAllSpeech();return basePaperIsleBack?basePaperIsleBack():false;};
  document.body.dataset.accent=state.accent;
  render();
})();
