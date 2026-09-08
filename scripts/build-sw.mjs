import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
async function walk(dir){const entries=await readdir(dir,{withFileTypes:true});const nested=await Promise.all(entries.map(e=>e.isDirectory()?walk(dir+'/'+e.name):Promise.resolve([dir+'/'+e.name])));return nested.flat();}
const base=process.env.VITE_BASE_PATH||'/';
if(!/^\/[a-zA-Z0-9_/-]*$/.test(base)||!base.endsWith('/'))throw Error('Invalid base path');
const manifest=JSON.parse(await readFile('public/manifest.webmanifest','utf8'));
manifest.id=base;manifest.start_url=base;manifest.scope=base;manifest.icons=manifest.icons.map(icon=>({...icon,src:base+icon.src.replace(/^\//,'')}));
await writeFile('out/manifest.webmanifest',JSON.stringify(manifest));
const files=(await walk('out')).filter(f=>!f.endsWith('/sw.js')).sort();
const hash=createHash('sha256');for(const file of files)hash.update(await readFile(file));
const cache='liangren-shell-'+createHash('sha256').update(base).digest('hex').slice(0,8)+'-'+hash.digest('hex').slice(0,12);
const urls=files.map(f=>base+f.slice(4));
const source=`const BASE=${JSON.stringify(base)};const PREFIX=${JSON.stringify("liangren-shell-"+createHash("sha256").update(base).digest("hex").slice(0,8)+"-")};const CACHE=${JSON.stringify(cache)};const URLS=${JSON.stringify(urls)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(URLS.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;
 if(request.mode==='navigate'){event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(BASE+'index.html',copy)));}return response;}).catch(async()=>{const saved=await caches.match(BASE+'index.html');return saved||new Response('首次使用请联网打开两人小账。',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});}));return;}
 if(URLS.includes(url.pathname))event.respondWith(caches.match(request).then(saved=>saved||fetch(request)));
});`;
await writeFile('out/sw.js',source);
console.log('Offline shell generated:',urls.length,'files;',cache);
