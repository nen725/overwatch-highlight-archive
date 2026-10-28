const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state={clips:[],heroes:[],heroNames:{},folders:[],jobs:[],language:'en'},tab='library',selected=new Set(),filters={search:'',hero:'',mode:'',sort:'new'},toastTimer,refreshing=false;
const t=(key,params)=>I18n.t(state.language,key,params);
const modes={'待补充':'pending','快速':'quick','竞技':'competitive','街机先锋':'arcade','自定义':'custom','其他':'other'};
const statuses={'等待中':'queued','压缩中':'compressing','已完成':'completed','已取消':'cancelled','失败':'failed'};
const bytes=n=>n>=1073741824?`${(n/1073741824).toFixed(2)} GB`:`${(n/1048576).toFixed(1)} MB`;
const duration=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const date=s=>new Intl.DateTimeFormat(state.language,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(s));
const heroName=key=>state.heroNames?.[state.language]?.[key]||state.heroes.find(h=>h.key===key)?.name||t('unmarkedHero');
const modeName=mode=>t(modes[mode]||'other');
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',5500)}
async function call(name,data){try{return await window.api.call(name,data)}catch(e){toast(I18n.message(state.language,e.message.replace(/^Error invoking remote method '[^']+': Error: /,'')));throw e}}
function intro(titleKey,subtitleKey,extra=''){return `<div class="page-intro"><div><div class="eyebrow">YOUR MOMENTS. YOUR LEGACY.</div><h1>${t(titleKey)}</h1><p>${t(subtitleKey)}</p></div>${extra}</div>`}
function filtered(){return state.clips.filter(c=>(tab!=='favorites'||c.favorite)&&(!filters.search||`${c.title} ${c.notes} ${heroName(c.hero)}`.toLowerCase().includes(filters.search.toLowerCase()))&&(!filters.hero||c.hero===filters.hero)&&(!filters.mode||c.mode===filters.mode)).sort((a,b)=>filters.sort==='size'?b.size-a.size:filters.sort==='old'?Date.parse(a.recordedAt)-Date.parse(b.recordedAt):Date.parse(b.recordedAt)-Date.parse(a.recordedAt))}
function localizeShell(){
 document.documentElement.lang=state.language;document.title=t('appName');
 document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));
 document.querySelectorAll('[data-i18n-aria]').forEach(e=>e.setAttribute('aria-label',t(e.dataset.i18nAria)));
 document.querySelectorAll('[data-i18n-placeholder]').forEach(e=>e.placeholder=t(e.dataset.i18nPlaceholder));
}
function render(){
 localizeShell();document.body.hidden=false;
 $('#navCount').textContent=state.clips.length;$('#jobCount').textContent=state.jobs.filter(j=>['等待中','压缩中'].includes(j.status)).length;
 $('#scanStatus').textContent=t(state.scanning?'scanning':state.folders.length?'monitoring':'needsFolder');$('#rescan').disabled=!!state.scanning;
 document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$('#crumb').textContent=t(tab);
 if(tab==='library'||tab==='favorites')renderLibrary();else if(tab==='settings')renderSettings();else renderJobs();
}
function renderLibrary(){
 const clips=filtered(),available=state.clips.filter(c=>!c.missing),size=bytes(available.reduce((s,c)=>s+c.size,0)).split(' ');
 $('#page').innerHTML=intro(tab,'librarySubtitle',`<span class="tag">${t('localArchive')}</span>`)+
 `<div class="stats"><div class="stat"><label>${t('totalClips')}</label><strong>${state.clips.length}</strong><small>${t('clipsUnit')}</small></div><div class="stat"><label>${t('savedMoments')}</label><strong>${state.clips.filter(c=>c.favorite).length}</strong><small>${t('favoritesUnit')}</small></div><div class="stat"><label>${t('videoSize')}</label><strong>${size[0]}</strong><small>${size[1]}</small></div><div class="stat"><label>${t('totalDuration')}</label><strong>${Math.round(available.reduce((s,c)=>s+c.duration,0)/60)}</strong><small>${t('minutes')}</small></div></div>`+
 `<div class="toolbar"><input id="search" aria-label="${t('search')}" type="search" placeholder="${t('search')}" value="${esc(filters.search)}"><select id="filterHero" aria-label="${t('allHeroes')}"><option value="">${t('allHeroes')}</option>${state.heroes.map(h=>`<option value="${esc(h.key)}" ${h.key===filters.hero?'selected':''}>${esc(heroName(h.key))}</option>`).join('')}</select><select id="filterMode" aria-label="${t('allModes')}"><option value="">${t('allModes')}</option>${Object.keys(modes).map(m=>`<option value="${m}" ${m===filters.mode?'selected':''}>${modeName(m)}</option>`).join('')}</select><select id="sort" aria-label="${t('newest')}">${['new','old','size'].map((value,i)=>`<option value="${value}" ${filters.sort===value?'selected':''}>${t(['newest','oldest','largest'][i])}</option>`).join('')}</select></div><div class="section-head"><strong>${t(tab==='favorites'?'yourFavorites':'yourArchive')} <span class="muted">/ ${clips.length}</span></strong><button id="selectAll" class="quiet">${t(clips.length&&clips.filter(c=>!c.missing).every(c=>selected.has(c.id))?'deselectAll':'selectPage')}</button></div>`+
 (clips.length?`<div class="grid">${clips.map(c=>`<article class="card ${selected.has(c.id)?'selected':''}"><div class="thumb" data-open="${c.id}"><input aria-label="${esc(t('selectClip',{title:c.title}))}" class="pick" type="checkbox" data-pick="${c.id}" ${selected.has(c.id)?'checked':''} ${c.missing?'disabled':''}><img src="media://${c.id}/thumb" alt="${esc(t('thumbnail',{title:c.title}))}"><span class="badge">${c.missing?t('offline'):modeName(c.mode)}</span><span class="duration">${duration(c.duration)}</span><span class="play">▷</span></div><div class="card-body"><h3 class="card-title">${esc(c.title)}</h3><div class="meta"><span class="hero-name">${esc(heroName(c.hero))}</span><span>${new Intl.DateTimeFormat(state.language).format(new Date(c.recordedAt))} · ${bytes(c.size)}</span></div><p class="note">${esc(c.notes||t('noteHint'))}</p><div class="card-actions"><button data-open="${c.id}">${t('edit')}</button><button aria-label="${t(c.favorite?'unfavorite':'favorite')}" data-favorite="${c.id}">${c.favorite?'★':'☆'}</button></div></div></article>`).join('')}</div>`:
 `<div class="empty"><div class="symbol">◈</div><h2>${t(state.clips.length?'noMatches':'emptyTitle')}</h2><p>${t(state.clips.length?'filterHint':'importHint')}</p><button class="primary" id="emptyAction">${t(state.clips.length?'clearFilters':'addFolder')}</button></div>`)+
 (selected.size?`<div class="selection"><span>${t('selected',{count:selected.size})}</span><button id="clearSelection" class="quiet">${t('clearSelection')}</button><select id="preset"><option value="small">${t('small')}</option><option value="quality">${t('quality')}</option></select><button id="compress" class="primary">${t('compress')}</button></div>`:'');
 $('#search').oninput=e=>{const pos=e.target.selectionStart;filters.search=e.target.value;renderLibrary();$('#search').focus();$('#search').setSelectionRange(pos,pos)};
 $('#filterHero').onchange=e=>{filters.hero=e.target.value;renderLibrary()};$('#filterMode').onchange=e=>{filters.mode=e.target.value;renderLibrary()};$('#sort').onchange=e=>{filters.sort=e.target.value;renderLibrary()};
 document.querySelectorAll('[data-open]').forEach(b=>b.onclick=e=>{if(!e.target.matches('[data-pick]'))openEditor(b.dataset.open)});
 document.querySelectorAll('[data-pick]').forEach(b=>{b.onclick=e=>e.stopPropagation();b.onchange=()=>{b.checked?selected.add(b.dataset.pick):selected.delete(b.dataset.pick);renderLibrary()}});
 document.querySelectorAll('[data-favorite]').forEach(b=>b.onclick=async()=>{const c=state.clips.find(c=>c.id===b.dataset.favorite);await call('save',{...c,favorite:!c.favorite})});
 $('#selectAll').onclick=()=>{const all=clips.filter(c=>!c.missing),remove=all.every(c=>selected.has(c.id));all.forEach(c=>remove?selected.delete(c.id):selected.add(c.id));renderLibrary()};
 if($('#emptyAction'))$('#emptyAction').onclick=()=>{if(state.clips.length){filters={search:'',hero:'',mode:'',sort:'new'};renderLibrary()}else call('addFolder').then(update)};
 if($('#compress')){$('#clearSelection').onclick=()=>{selected.clear();renderLibrary()};$('#compress').onclick=async()=>{const count=state.jobs.length;const next=await call('compress',{ids:[...selected],preset:$('#preset').value});if(next.jobs.length>count){selected.clear();tab='jobs'}update(next)}}
}
function renderSettings(){
 $('#page').innerHTML=intro('settings','settingsSubtitle')+
 `<div class="panel"><h3>${t('language')}</h3><label for="languageSelect" class="muted">${t('languageHint')}</label><div class="language-row"><select id="languageSelect" aria-label="${t('language')}">${[['zh-CN','简体中文'],['en','English'],['ja','日本語'],['ko','한국어']].map(([value,name])=>`<option value="${value}" ${state.language===value?'selected':''}>${name}</option>`).join('')}</select><span class="muted">${esc(t('systemLanguage',{locale:state.systemLocale||'—'}))}</span></div></div>`+
 `<div class="panel"><h3>${t('heroData')}</h3><p>${t('heroDataHint')}</p><p class="muted">${t('heroSummary',{count:state.heroes.length,time:state.heroesUpdated?date(state.heroesUpdated):t('bundled')})} · ${t(state.heroesSource?.includes('OverFast')?'backupSource':'officialSource')}</p>${state.heroError?`<p class="error">${esc(I18n.message(state.language,state.heroError))}</p>`:''}<button class="primary" id="refreshHeroes" ${refreshing?'disabled':''}>${t(refreshing?'updatingHeroes':'updateHeroes')}</button></div>`+
 `<div class="panel"><h3>${t('watchFolders')}</h3><p>${t('watchHint')}</p>${state.folders.map((f,i)=>`<div class="folder"><code>${esc(f)}</code><button data-remove="${i}">${t('removeWatch')}</button></div>`).join('')||`<p>${t('noFolders')}</p>`}<button id="settingsAdd" class="primary">${t('addFolder')}</button></div>`+
 `<div class="panel"><h3>${t('fileSafety')}</h3><p>${t('detectionHint')}</p><p>${t('exportHint')}</p><p>${t('compressionHint')}</p></div><div class="panel"><h3>${t('sources')}</h3><p>${t('sourceHint')}</p><p>${t('copyright')}</p></div>`+
 (state.scanErrors?.length?`<div class="panel"><h3>${t('scanErrors')}</h3><div class="error">${esc(state.scanErrors.map(e=>I18n.message(state.language,e)).join('\n'))}</div></div>`:'');
 $('#languageSelect').onchange=async e=>{e.target.disabled=true;try{update(await call('language',e.target.value));toast(t('languageSaved'))}catch{renderSettings()}};
 $('#refreshHeroes').onclick=async()=>{refreshing=true;renderSettings();try{update(await call('heroes'));toast(t('heroesUpdated'))}finally{refreshing=false;if(tab==='settings')renderSettings()}};
 $('#settingsAdd').onclick=()=>call('addFolder').then(update);
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>call('removeFolder',state.folders[Number(b.dataset.remove)]).then(update));
}
function renderJobs(){
 $('#page').innerHTML=intro('jobs','jobsSubtitle','<span class="tag">H.264 / AAC</span>')+(state.jobs.length?state.jobs.slice().reverse().map(j=>`<div class="job"><div class="job-content"><div class="job-title">${esc(j.title)}</div><div class="meta"><span>${t(j.preset==='small'?'smallMax':'qualityMax')}</span><span>${t(statuses[j.status]||'failed')}${j.status==='压缩中'?` · ${j.progress}%`:''}</span></div><progress class="progress" max="100" value="${j.progress}"></progress><p>${j.status==='已完成'?`${bytes(j.sourceSize)} → ${bytes(j.size)} · ${esc(j.output)}`:t('sourceKept')}</p>${j.error?`<div class="error">${esc(I18n.message(state.language,j.error))}</div>`:''}</div>${j.status==='已完成'?`<button data-output="${j.id}">${t('openOutput')}</button>`:['等待中','压缩中'].includes(j.status)?`<button data-cancel="${j.id}">${t('cancelJob')}</button>`:''}</div>`).join(''):`<div class="empty"><div class="symbol">⇩</div><h2>${t('shareTitle')}</h2><p>${t('shareHint')}</p><button id="backLibrary" class="primary">${t('backLibrary')}</button></div>`);
 document.querySelectorAll('[data-output]').forEach(b=>b.onclick=()=>call('openOutput',b.dataset.output));document.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>call('cancel',b.dataset.cancel).then(update));if($('#backLibrary'))$('#backLibrary').onclick=()=>{tab='library';render()};
}
function openEditor(key){
 const c=state.clips.find(c=>c.id===key);if(!c)return;
 $('#clipId').value=c.id;$('#editHeading').textContent=c.title;$('#editTitle').value=c.title;
 $('#editHero').innerHTML=`<option value="">${t('pending')}</option>`+state.heroes.map(h=>`<option value="${esc(h.key)}">${esc(heroName(h.key))} · ${t(h.role)}</option>`).join('');$('#editHero').value=c.hero;
 $('#editMode').innerHTML=Object.keys(modes).map(m=>`<option value="${m}">${modeName(m)}</option>`).join('');$('#editMode').value=c.mode;
 const d=new Date(c.recordedAt);$('#editTime').value=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);$('#editNotes').value=c.notes;$('#editFavorite').checked=c.favorite;
 $('#fileInfo').textContent=`${c.width} × ${c.height} · ${c.codec} · ${duration(c.duration)} · ${bytes(c.size)}${c.missing?' · '+t('offline'):''}\n${c.path}`;
 $('#player').src=`media://${c.id}/video`;$('#reveal').onclick=()=>call('reveal',c.id);$('#editor').showModal();
}
function closeEditor(){$('#player').pause();$('#player').removeAttribute('src');$('#player').load();$('#editor').close()}
$('#closeEditor').onclick=closeEditor;$('#editor').addEventListener('cancel',closeEditor);
$('#editForm').onsubmit=async e=>{e.preventDefault();await call('save',{id:$('#clipId').value,title:$('#editTitle').value,hero:$('#editHero').value,mode:$('#editMode').value,recordedAt:new Date($('#editTime').value).toISOString(),notes:$('#editNotes').value,favorite:$('#editFavorite').checked});closeEditor();toast(t('saved'))};
$('#player').onerror=()=>{if($('#player').getAttribute('src'))toast(t('playbackError'))};
function update(next){state=next;render()}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()});$('#addFolder').onclick=()=>call('addFolder').then(update);$('#rescan').onclick=()=>call('scan').then(update);window.api.onUpdate(update);call('state').then(update);
window.addEventListener('unhandledrejection',e=>e.preventDefault());
