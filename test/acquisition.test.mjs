import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../analytics.js',import.meta.url),'utf8');
const product='fita', host='appfita.ru', apiName=product.toUpperCase()+'_ANALYTICS';
const source=p=>p.utm_source??p.source;
const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
function page(search='',session=storage(),now=1700000000000) {
  const calls=[],timers=[],handlers={};let seq=0;
  const loc=new URL('https://'+host+'/'+search);
  const doc={readyState:'complete',referrer:'',title:'Home',visibilityState:'visible',documentElement:{scrollHeight:1000},currentScript:{getAttribute:k=>({'data-api':'https://api.appfita.ru','data-collect':'1'})[k]},querySelectorAll:()=>[],querySelector:()=>null,addEventListener:(n,f)=>{handlers[n]=f}};
  const win={document:doc,location:loc,localStorage:storage(),sessionStorage:session,URL,URLSearchParams,navigator:{language:'en'},screen:{width:100,height:100},innerWidth:100,innerHeight:100,history:{pushState(){},replaceState(){}},addEventListener:(n,f)=>{handlers[n]=f},crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`},setTimeout:f=>{timers.push(f);return timers.length},fetch:async(url,opts)=>{calls.push(JSON.parse(opts.body));return{status:204}}};
  const clock=class extends Date{static now(){return now}};
  vm.runInNewContext(code,{window:win,URL,URLSearchParams,Date:clock,Intl,Uint8Array,Blob,setTimeout:win.setTimeout,clearTimeout(){}});
  const flush=async()=>{let guard=0;while(timers.length&&guard++<10){timers.shift()();await Promise.resolve()}};
  return{win,flush,calls,events:()=>calls.flatMap(c=>c.events),navigate:s=>{win.location=new URL('https://'+host+'/'+s);handlers.popstate?.()}};
}
test('all five safe UTM tags reach events and persist across navigation',async()=>{
  const session=storage(),a=page('?utm_source=Telegram&utm_medium=Post&utm_campaign=Launch&utm_term=Fitness&utm_content=Bio',session);
  await a.flush();const props=a.events()[0].properties;
  assert.equal(source(props),'telegram');assert.equal(props.utm_content,'bio');assert.equal(props.utm_term,'fitness');
  const b=page('',session,1700000001000);await b.flush();assert.equal(source(b.events()[0].properties),'telegram');
});
test('a tagged return replaces the entire campaign and expires after inactivity',async()=>{
  const session=storage(),a=page('?utm_source=one&utm_campaign=old',session);await a.flush();
  const b=page('?utm_source=two',session,1700000001000);await b.flush();const p=b.events()[0].properties;
  assert.equal(source(p),'two');assert.equal(p.utm_campaign??p.campaign,undefined);
  const c=page('',session,1700000001000+31*60000);await c.flush();assert.equal(source(c.events()[0].properties),undefined);
});
test('PII, arbitrary URL parameters and corrupt stored values never become campaign tags',async()=>{
  const session=storage();session.setItem(product+'_acquisition_v1',JSON.stringify({at:1700000000000,values:{utm_source:'person@example.com',email:'private',utm_campaign:'valid',__proto__:'pollution'}}));
  const a=page('?utm_source=person%40example.com&utm_content=https%3A%2F%2Fsecret&utm_term=hello%20world&token=secret',session);await a.flush();
  const props=a.events()[0].properties;assert.equal(source(props),undefined);assert.equal(props.utm_content,undefined);assert.equal(props.utm_term,undefined);assert.doesNotMatch(JSON.stringify(a.calls),/example\.com|secret|hello world|pollution/);
});
if(product!=='fita')test('SPA query-only arrivals count and page_leave keeps its former campaign',async()=>{
  const a=page('?utm_source=one');await a.flush();a.navigate('?utm_source=two');await a.flush();
  const events=a.events();assert.equal(events.filter(e=>e.name==='page_view').length,2);
  assert.equal(source(events.find(e=>e.name==='page_leave').properties),'one');assert.equal(source(events.at(-1).properties),'two');
});
