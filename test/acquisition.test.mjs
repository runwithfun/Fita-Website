import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../analytics.js',import.meta.url),'utf8');
const product='fita', host='appfita.ru', apiName=product.toUpperCase()+'_ANALYTICS';
const source=p=>p.utm_source??p.source;
const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
function page(search='',session=storage(),now=1700000000000,{local=storage(),ua='',referrer=''}={}) {
  const calls=[],timers=[],handlers={};let seq=0;
  const loc=new URL('https://'+host+'/'+search);
  const doc={readyState:'complete',referrer,title:'Home',visibilityState:'visible',documentElement:{scrollHeight:1000},currentScript:{getAttribute:k=>({'data-api':'https://api.appfita.ru','data-collect':'1'})[k]},querySelectorAll:()=>[],querySelector:()=>null,addEventListener:(n,f)=>{handlers[n]=f}};
  const win={document:doc,location:loc,localStorage:local,sessionStorage:session,URL,URLSearchParams,navigator:{language:'en',userAgent:ua},screen:{width:100,height:100},innerWidth:100,innerHeight:100,history:{pushState(){},replaceState(){}},addEventListener:(n,f)=>{handlers[n]=f},crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`},setTimeout:f=>{timers.push(f);return timers.length},fetch:async(url,opts)=>{calls.push(JSON.parse(opts.body));return{status:204}}};
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

test('a visit keeps raw acquisition facts: ad click id, landing params, first touch and visit number',async()=>{
  const session=storage(),local=storage(),a=page('?fbclid=IwAR0abc_DEF-1.2&utm_source=instagram&X=1&x=2',session,1700000000000,{local});await a.flush();
  const p=a.events()[0].properties;
  assert.equal(p.click_id_type,'fbclid');assert.equal(p.click_id,'IwAR0abc_DEF-1.2');
  assert.equal(p.landing_params,'fbclid,utm_source,x');assert.equal(p.landing_path,'/');assert.equal(p.visit_number,1);
  assert.equal(p.first_source,'instagram');assert.equal(p.first_landing,'/');assert.equal(p.days_since_first_visit,0);
  const later=page('space',session,1700000060000,{local});await later.flush();const l=later.events()[0];
  assert.equal(l.path,'/space');assert.equal(l.properties.landing_path,'/','the landing stays for the whole visit');
  assert.equal(l.properties.click_id_type,'fbclid','the click id stays for the whole visit');assert.equal(l.properties.visit_number,1);
  const untagged=page('?gclid=Cj0KCQ');await untagged.flush();const u=untagged.events()[0].properties;
  assert.equal(u.first_source,'click:gclid');assert.equal(source(u),undefined,'click ids never invent a UTM source');
  const bad=page('?fbclid=%3Cscript%3E');await bad.flush();assert.equal(bad.events()[0].properties.click_id,undefined);
});
test('ChatGPT ad click ids are kept like other ad click ids',async()=>{
  const a=page('?utm_source=gpt&utm_campaign=1026&oppref=Ab1_x-2&olref=Zz9');await a.flush();
  const p=a.events()[0].properties;
  assert.equal(p.click_id_type,'oppref');assert.equal(p.click_id,'Ab1_x-2');assert.equal(p.landing_params,'utm_source,utm_campaign,oppref,olref');
});
test('a returning browser keeps its first touch and counts its visits; in-app browsers are named',async()=>{
  const local=storage(),first=page('?utm_source=reddit&utm_medium=social',storage(),1700000000000,{local,referrer:'https://www.reddit.com/r/x'});await first.flush();
  assert.equal(first.events()[0].properties.first_referrer,'www.reddit.com');
  const back=page('space',storage(),1700000000000+3*86400000,{local,ua:'Mozilla/5.0 (iPhone) Instagram 300.0'});await back.flush();
  const p=back.events()[0].properties;
  assert.equal(p.visit_number,2);assert.equal(p.first_source,'reddit');assert.equal(p.first_medium,'social');assert.equal(p.first_landing,'/');
  assert.equal(p.landing_path,'/space');assert.equal(p.days_since_first_visit,3);assert.equal(source(p),undefined);assert.equal(p.in_app_browser,'instagram');
});
test('malformed stored facts start afresh instead of reaching the strict server',async()=>{
  const local=storage(),session=storage();
  local.setItem('fita_first_touch_v1',JSON.stringify({at:1,source:'person@example.com',landing:'/'}));local.setItem('fita_visits','1e999');
  session.setItem('fita_visit_v1',JSON.stringify({at:1700000000000,number:4,click:'gclid',clickId:'<b>',params:'',landing:'/',referrer:''}));
  const a=page('',session,1700000000000,{local});await a.flush();const p=a.events()[0].properties;
  assert.equal(p.first_source,'direct');assert.equal(p.visit_number,2);assert.equal(p.click_id,undefined);assert.doesNotMatch(JSON.stringify(a.calls),/example|<b>/);
  for(const visit of [{click:'gclid'},{params:7},{params:'a,B'},{referrer:'localhost'},{number:'4'},{landing:'/privacy'}]){
    const session=storage();session.setItem('fita_visit_v1',JSON.stringify({at:1700000000000,number:4,click:'',clickId:'',params:'',landing:'/',referrer:'',...visit}));
    const b=page('',session,1700000000000);await b.flush();const q=b.events()[0].properties;
    assert.equal(q.visit_number,1,JSON.stringify(visit));assert.equal(q.click_id_type,undefined);assert.equal(q.landing_params,undefined);
  }
  local.setItem('fita_first_touch_v1',JSON.stringify({at:1,source:'direct',medium:7,campaign:'',referrer:'',landing:'/'}));
  const c=page('',storage(),1700000000000,{local});await c.flush();assert.equal(c.events()[0].properties.first_medium,undefined);
  assert.equal(c.events()[0].properties.days_since_first_visit,0,'a malformed first touch starts afresh');
});
test('a full batch of the largest possible events stays within the server limits',async()=>{
  const host=['h'.repeat(63),'h'.repeat(62),'h'.repeat(62),'h'.repeat(59)].join('.')+'.com',long=c=>c.repeat(64);
  const local=storage();local.setItem('fita_first_touch_v1',JSON.stringify({at:1,source:host,medium:long('m'),campaign:long('c'),referrer:host,landing:'/space'}));
  const names=Array.from({length:12},(_,i)=>String(i).padStart(40,'k')+'=1').join('&');
  const a=page('space?'+names+'&fbclid='+'f'.repeat(300)+'&utm_source='+long('s')+'&utm_medium='+long('m')+'&utm_campaign='+long('c')+'&utm_term='+long('t')+'&utm_content='+long('o')+'&ref=ABCDEFGH23456789',storage(),1700000000000,{local,ua:'Instagram',referrer:'https://'+host+'/'});
  await a.flush();const e=a.events()[0],p=e.properties;
  assert.equal(p.click_id.length,300);assert.equal(p.landing_params.split(',').length,12);assert.equal(p.first_source,host);assert.equal(p.referrer_host,host);
  // Umami keeps at most 50 properties per event; the server and OpenPanel add up to 10 of their own.
  assert.ok(Object.keys(p).length<=40,Object.keys(p).length+' properties');
  const batch=Number(code.match(/var BATCH = (\d+);/)[1]);
  const body=JSON.stringify({visitor_id:a.calls[0].visitor_id,events:Array(batch).fill(e)});
  assert.ok(body.length<16*1024,'a full batch is '+body.length+' bytes');
});
