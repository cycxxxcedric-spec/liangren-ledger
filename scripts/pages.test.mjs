import {readFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const base='/liangren-ledger/';
const source=await readFile('out/sw.js','utf8');
const manifest=JSON.parse(await readFile('out/manifest.webmanifest','utf8'));
assert.equal(manifest.scope,base);assert.equal(manifest.start_url,base);
const html=await readFile('out/index.html','utf8');
for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){assert.ok(match[1].startsWith(base),match[1]);await access('out/'+match[1].slice(base.length));}
const handlers={};let urls=[],cacheKey,matched;
const context={self:{addEventListener:(name,fn)=>handlers[name]=fn,location:{origin:'https://example.test'},skipWaiting:()=>{},clients:{claim:async()=>{}}},caches:{open:async key=>{cacheKey=key;return {addAll:async list=>{urls=list},put:async()=>{}}},keys:async()=>[],match:async key=>{matched=key;return new Response('offline')}},URL,Request:class{constructor(url){this.url=url}},Response,fetch:async()=>{throw Error('offline')}};
vm.runInNewContext(source,context);let work;handlers.install({waitUntil:p=>work=p});await work;
for(const {url} of urls){assert.ok(url.startsWith(base));await access('out/'+url.slice(base.length));}
let response;handlers.fetch({request:{url:'https://example.test'+base,method:'GET',mode:'navigate'},respondWith:p=>response=p});assert.equal(await(await response).text(),'offline');assert.equal(matched,base+'index.html');
let otherIntercepted=false;handlers.fetch({request:{url:'https://example.test/swiss-trip/',method:'GET',mode:'navigate'},respondWith:()=>otherIntercepted=true});assert.equal(otherIntercepted,false);
console.log('PASS: all subpath assets, manifest, offline fallback and other-site isolation',cacheKey);
