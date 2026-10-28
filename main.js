const {app,BrowserWindow,ipcMain,dialog,shell,protocol,net} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {spawn} = require('node:child_process');
const {video,id,infer,validateEdit} = require('./core');
const {localize} = require('./localization');
const I18n = require('./i18n');
if(process.platform==='win32')app.setAppUserModelId('local.overwatch.highlights');
protocol.registerSchemesAsPrivileged([{scheme:'media',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}},{scheme:'archive',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
let win, db, home, scanning=false, timer, jobs=[], running=false, currentChild;
let stopping=false;
let systemLocale='';
const tr=(key,params)=>I18n.t(db?.language||'en',key,params);
const tools = n => require(n).replace('app.asar','app.asar.unpacked');
const ffmpeg=()=>tools('ffmpeg-static');
const ffprobe=()=>require('ffprobe-static').path.replace('app.asar','app.asar.unpacked');
async function save(){ const temp=path.join(home,'library.tmp'); await fs.writeFile(temp,JSON.stringify(db,null,2)); await fs.rename(temp,path.join(home,'library.json')); }
let writes=Promise.resolve();
function persist(){ writes=writes.then(save,save); return writes; }
function publish(){ if(win && !win.isDestroyed()) win.webContents.send('update',snapshot()); }
function snapshot(){return {...db,jobs,scanning,systemLocale};}
function run(exe,args){return new Promise((resolve,reject)=>{let out='',err='';const child=spawn(exe,args,{windowsHide:true});const timeout=setTimeout(()=>child.kill(),45000);child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err=(err+x).slice(-8000));child.on('error',e=>{clearTimeout(timeout);reject(e)});child.on('close',c=>{clearTimeout(timeout);c===0?resolve(out):reject(Error(err||`进程退出 ${c}`))});});}
async function stable(file){const a=await fs.stat(file);await new Promise(r=>setTimeout(r,500));const b=await fs.stat(file);return a.size===b.size&&a.mtimeMs===b.mtimeMs&&b.size>0;}
async function* walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())yield* walk(p);else if(e.isFile()&&video(p))yield p;}}
async function scan(){
 if(scanning||stopping)return;scanning=true;publish();
 const errors=[]; const seen=new Set();
 try{for(const folder of db.folders){try{for await(const file of walk(folder)){
 const key=id(file);seen.add(key);const existing=db.clips.find(c=>c.id===key);let stat;try{stat=await fs.stat(file)}catch{continue}
 if(existing&&existing.size===stat.size&&existing.modified===stat.mtimeMs){existing.missing=false;continue}
 try{if(!await stable(file))continue;
 const info=JSON.parse(await run(ffprobe(),['-v','error','-show_format','-show_streams','-of','json',file]));
 const stream=info.streams.find(s=>s.codec_type==='video');if(!stream)continue;
 const thumb=path.join(home,'thumbnails',`${key}.jpg`);
 try{await run(ffmpeg(),['-y','-ss','0','-i',file,'-frames:v','1','-vf','scale=640:-2',thumb]);}catch{}
 const metadata={id:key,path:file,size:stat.size,modified:stat.mtimeMs,duration:Number(info.format.duration)||0,width:stream.width,height:stream.height,codec:stream.codec_name,missing:false};
 if(existing)Object.assign(existing,metadata);else db.clips.push({...metadata,...infer(file,db.heroes),recordedAt:stat.birthtime.toISOString(),notes:'',favorite:false});
 }catch(e){errors.push(`${path.basename(file)}: ${e.message.slice(0,160)}`)}
 }}catch(e){errors.push(`${folder}: ${e.message}`)}}
 for(const c of db.clips)if(!seen.has(c.id))c.missing=true;
 db.scanErrors=errors.slice(-20);db.lastScan=new Date().toISOString();await persist();
 }finally{scanning=false;publish()}
}
async function refreshHeroNames(){
 const locales={en:'en-us',ja:'ja-jp',ko:'ko-kr'};
 await Promise.allSettled(Object.entries(locales).map(async([language,locale])=>{
 const r=await fetch(`https://overfast-api.tekrop.fr/heroes?locale=${locale}`,{signal:AbortSignal.timeout(20000)});if(!r.ok)return;
 const rows=await r.json();if(!Array.isArray(rows)||rows.length<20||rows.some(h=>typeof h.key!=='string'||typeof h.name!=='string'))return;
 db.heroNames[language]=Object.fromEntries(rows.map(h=>[h.key,h.name]));
 }));
}
async function refreshHeroes(){
 try {
 const response=await fetch('https://ld5.res.netease.com/pc/zt/20241115153332/static/heroConfigs.json',{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('官方资料不可用');
 const data=await response.json();const roles={Tank:'tank',Damage:'damage',Support:'support'};
 if(!Array.isArray(data.heroConfigs)||data.heroConfigs.length<20)throw Error('官方资料结构变化');
 const rows=data.heroConfigs.map(h=>({key:h.id==='jetpackcat'?'jetpack-cat':h.id,name:h.name,role:roles[h.type],portrait:h.headSrc}));
 if(rows.some(h=>!h.key||!h.name||!h.role||!h.portrait?.startsWith('https://')))throw Error('官方资料缺失字段');
 db.heroes=rows;db.heroNames['zh-CN']=Object.fromEntries(rows.map(h=>[h.key,h.name]));db.heroesSource='守望先锋国服官网';db.heroesUpdated=new Date().toISOString();db.heroError=null;await refreshHeroNames();await persist();publish();return snapshot();
 }catch{}
 const response=await fetch('https://overfast-api.tekrop.fr/heroes?locale=en-us',{signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error(tr('heroUnavailable',{status:response.status}));
 const rows=await response.json();
 if(!Array.isArray(rows)||rows.length<20||rows.some(h=>typeof h.key!=='string'||typeof h.name!=='string'||!['tank','damage','support'].includes(h.role)))throw Error('英雄数据格式异常，已保留缓存');
 db.heroes=localize(rows.map(h=>({key:h.key,name:h.name,role:h.role,portrait:typeof h.portrait==='string'&&h.portrait.startsWith('https://')?h.portrait:''})));
 db.heroNames.en=Object.fromEntries(rows.map(h=>[h.key,h.name]));db.heroesSource='OverFast API（备用）';db.heroError=null;db.heroesUpdated=new Date().toISOString();await refreshHeroNames();await persist();publish();return snapshot();
}
async function compressNext(){
 if(running||stopping)return;const job=jobs.find(j=>j.status==='等待中');if(!job)return;
 running=true;job.status='压缩中';publish();let handle;
 try{
 const clip=db.clips.find(c=>c.id===job.clipId);if(!clip)throw Error('视频不存在');
 const suffix=`-${Date.now()}-${job.id.slice(0,8)}.mp4`;job.output=path.join(job.dir,`${path.basename(clip.path,path.extname(clip.path))}-share${suffix}`);
 // Reserve destination exclusively. Never write to a source path or an existing output.
 handle=await fs.open(job.output,'wx');await handle.close();handle=null;
 await new Promise((resolve,reject)=>{
 const args=['-y','-i',clip.path,'-map','0:v:0','-map','0:a:0?','-vf',`scale=w='min(${job.preset==='small'?1280:1920},iw)':h=-2`,'-c:v','libx264','-preset','medium','-crf',job.preset==='small'?'28':'23','-c:a','aac','-b:a','128k','-movflags','+faststart','-progress','pipe:1','-nostats',job.output];
 currentChild=spawn(ffmpeg(),args,{windowsHide:true});let err='',buffer='';
 currentChild.stdout.on('data',d=>{buffer+=d;const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){const m=line.match(/^out_time_us=(\d+)/);if(m){job.progress=Math.min(99,Math.round(Number(m[1])/1000000/Math.max(clip.duration,1)*100));publish()}}});
 currentChild.stderr.on('data',d=>err=(err+d).slice(-4000));currentChild.on('error',reject);currentChild.on('close',code=>code===0?resolve():reject(Error(job.cancelled?'已取消':err.slice(-400))));
 });
 job.status='已完成';job.progress=100;job.size=(await fs.stat(job.output)).size;
 }catch(e){job.status=job.cancelled?'已取消':'失败';job.error=e.message;if(job.output)await fs.unlink(job.output).catch(()=>{});}
 finally{if(handle)await handle.close();currentChild=null;running=false;publish();compressNext();}
}
ipcMain.handle('api',async(event,name,data)=>{try{
 if(event.sender!==win.webContents)throw Error('不支持的调用');
 switch(name){
 case 'state':return snapshot();
 case 'scan':await scan();return snapshot();
 case 'addFolder':{const r=await dialog.showOpenDialog(win,{title:tr('folderDialog'),properties:['openDirectory']});if(!r.canceled){const folder=r.filePaths[0];if(!db.folders.includes(folder))db.folders.push(folder);await persist();scan();}return snapshot()}
 case 'removeFolder':db.folders=db.folders.filter(f=>f!==data);await persist();await scan();return snapshot();
 case 'save':{const clip=db.clips.find(c=>c.id===data.id);if(!clip)throw Error('找不到视频');Object.assign(clip,validateEdit(data,db.heroes));await persist();publish();return snapshot()}
 case 'heroes':return refreshHeroes();
 case 'language':{if(!I18n.languages.includes(data))throw Error(tr('languageError'));db.language=data;await persist();win.setTitle(tr('appName'));publish();return snapshot();}
 case 'reveal':{const c=db.clips.find(c=>c.id===data);if(c)shell.showItemInFolder(c.path);return;}
 case 'compress':{if(!Array.isArray(data.ids)||!['small','quality'].includes(data.preset))throw Error('参数无效');const clips=[...new Set(data.ids)].map(key=>db.clips.find(c=>c.id===key&&!c.missing));if(!clips.length||clips.some(c=>!c))throw Error('请选择可用视频');const r=await dialog.showOpenDialog(win,{title:tr('outputDialog'),properties:['openDirectory','createDirectory']});if(r.canceled)return snapshot();for(const clip of clips)jobs.push({id:require('node:crypto').randomUUID(),clipId:clip.id,title:clip.title,sourceSize:clip.size,dir:r.filePaths[0],preset:data.preset,progress:0,status:'等待中'});compressNext();return snapshot()}
 case 'cancel':{const job=jobs.find(j=>j.id===data);if(job?.status==='等待中')job.status='已取消';else if(job?.status==='压缩中'){job.cancelled=true;currentChild?.kill();}publish();return snapshot()}
 case 'openOutput':{const job=jobs.find(j=>j.id===data&&j.status==='已完成');if(job)shell.showItemInFolder(job.output);return;}
 default:throw Error('未知操作');
 }
 }catch(e){throw Error(I18n.message(db?.language||'en',e.message));}
});
app.whenReady().then(async()=>{
 home=app.getPath('userData');await fs.mkdir(path.join(home,'thumbnails'),{recursive:true});
 try{db=JSON.parse(await fs.readFile(path.join(home,'library.json'),'utf8'));if(!Array.isArray(db.clips)||!Array.isArray(db.folders))throw Error('invalid');}
 catch(e){if(e.code!=='ENOENT'){await fs.copyFile(path.join(home,'library.json'),path.join(home,`library-backup-${Date.now()}.json`)).catch(()=>{});}db={clips:[],folders:[],heroes:[],heroesUpdated:null};}
 systemLocale=app.getSystemLocale();
 if(!I18n.languages.includes(db.language))db.language=I18n.detect(app.getPreferredSystemLanguages().length?app.getPreferredSystemLanguages():[systemLocale]);
 const bundledNames=JSON.parse(await fs.readFile(path.join(__dirname,'assets','hero-names.json'),'utf8').catch(()=>'{}'));
 db.heroNames=Object.fromEntries(I18n.languages.map(language=>[language,{...bundledNames[language],...db.heroNames?.[language]}]));
 await persist();
 if(!db.heroes?.length){try{db.heroes=localize(JSON.parse(await fs.readFile(path.join(__dirname,'assets','heroes.json'),'utf8')))}catch{db.heroes=[]}}
 if(!db.folders.length){const docs=app.getPath('documents');const ini=await fs.readFile(path.join(docs,'Overwatch','Settings','Settings_v0.ini'),'utf8').catch(()=>'');const configured=ini.match(/VideoPath\s*=\s*"?([^"\r\n]+)/i)?.[1]?.trim();for(const dir of [configured,path.join(docs,'Overwatch','videos','overwatch')].filter(Boolean)){if((await fs.stat(dir).catch(()=>null))?.isDirectory()&&!db.folders.includes(dir))db.folders.push(dir);}}
 protocol.handle('media',async req=>{const u=new URL(req.url);const clip=db.clips.find(c=>c.id===u.hostname);if(!clip)return new Response('Not found',{status:404});const file=u.pathname==='/thumb'?path.join(home,'thumbnails',`${clip.id}.jpg`):clip.path;return net.fetch(pathToFileURL(file).href,{headers:req.headers});});
 protocol.handle('archive',async req=>{const name=new URL(req.url).pathname.slice(1);const types={'index.html':'text/html; charset=utf-8','style.css':'text/css; charset=utf-8','locales.css':'text/css; charset=utf-8','renderer.js':'text/javascript; charset=utf-8','i18n.js':'text/javascript; charset=utf-8','app-icon.png':'image/png'};if(!Object.hasOwn(types,name))return new Response('Not found',{status:404});return new Response(await fs.readFile(path.join(__dirname,name==='app-icon.png'?'assets':'.',name)),{headers:{'Content-Type':types[name]}});});
 win=new BrowserWindow({show:!app.commandLine.hasSwitch('headless-review'),width:1440,height:940,minWidth:1080,minHeight:720,backgroundColor:'#111b2d',autoHideMenuBar:true,title:tr('appName'),icon:path.join(__dirname,'assets','app-icon.ico'),webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
 await win.loadURL('archive://app/index.html');scan();timer=setInterval(scan,12000);
 if(!db.heroesUpdated||Date.now()-Date.parse(db.heroesUpdated)>86400000)refreshHeroes().catch(e=>{db.heroError=e.message;publish()});
});
app.on('before-quit',()=>{stopping=true;clearInterval(timer);currentChild?.kill();});
app.on('window-all-closed',()=>app.quit());
