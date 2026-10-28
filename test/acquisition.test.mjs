import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../analytics.js',import.meta.url),'utf8');
const product='fita', host='appfita.ru', apiName=product.toUpperCase()+'_ANALYTICS';
const source=p=>p.utm_source??p.source;
const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
function page(search='',session=storage(),now=1700000000000,opts={}) {
  const {local=storage(),ua='',referrer='',providerToken=''}=typeof opts==='string'?{providerToken:opts}:opts;
  const calls=[],timers=[],handlers={};let seq=0;
  const loc=new URL('https://'+host+'/'+search);
  const doc={readyState:'complete',referrer,title:'Home',visibilityState:'visible',documentElement:{scrollHeight:1000},currentScript:{getAttribute:k=>({'data-api':'https://api.appfita.ru','data-collect':'1'})[k]},querySelectorAll:()=>[],querySelector:()=>null,addEventListener:(n,f)=>{handlers[n]=f}};
  const win={document:doc,location:loc,localStorage:local,sessionStorage:session,URL,URLSearchParams,navigator:{language:'en',userAgent:ua},screen:{width:100,height:100},innerWidth:100,innerHeight:100,history:{pushState(){},replaceState(){}},addEventListener:(n,f)=>{handlers[n]=f},crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`},setTimeout:f=>{timers.push(f);return timers.length},fetch:async(url,opts)=>{calls.push(JSON.parse(opts.body));return{status:204}}};
  const clock=class extends Date{static now(){return now}};
  const configured=code.replace("var APP_STORE_PROVIDER_TOKEN = '';",'var APP_STORE_PROVIDER_TOKEN = '+JSON.stringify(providerToken)+';');
  vm.runInNewContext(configured,{window:win,URL,URLSearchParams,Date:clock,Intl,Uint8Array,Blob,setTimeout:win.setTimeout,clearTimeout(){}});
  const flush=async()=>{let guard=0;while(timers.length&&guard++<10){timers.shift()();await Promise.resolve()}};
  return{win,flush,calls,events:()=>calls.flatMap(c=>c.events),advance:ms=>{now+=ms},click:(href,eventType='click',button=0)=>{const a=typeof href==='string'?{href}:href;handlers[eventType]?.({type:eventType,button,target:{closest:()=>a},preventDefault(){throw new Error('Navigation must not be blocked')}});return a;},navigate:s=>{win.location=new URL('https://'+host+'/'+s);handlers.popstate?.()}};
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
test('only FITA downloads count, with a bounded store property and no outbound URL',async()=>{
  const p=page();await p.flush();
  for(const href of ['https://apps.apple.com/app/id123','https://apps.apple.com/app/id67948483280','https://apps.apple.com.evil.test/app/id6794848328','http://apps.apple.com/app/id6794848328','https://user@apps.apple.com/app/id6794848328','https://releases.appfita.ru.evil.test/'])p.click(href);
  p.click('https://apps.apple.com/ru/app/fita/id6794848328');
  p.click('https://releases.appfita.ru/#v1');await p.flush();
  const clicks=p.events().filter(e=>e.name==='download_clicked');
  assert.deepEqual(clicks.map(e=>e.properties.store),['app_store','apk']);
  assert.ok(clicks.every(e=>!('href' in e.properties)));
});
test('App Store links stay byte-for-byte unchanged without a provider token or campaign',async()=>{
  for(const [search,token] of [['?utm_source=telegram&utm_campaign=launch',''],['?utm_source=telegram','bad-token'],['','123456']]){
    const p=page(search,storage(),1700000000000,token);await p.flush();
    const href='https://apps.apple.com/app/id6794848328?mt=8&pt=old&ct=existing#details';
    assert.equal(p.click(href).href,href);
  }
});
test('App Store campaign decoration uses the session campaign, preserves query and hash, and expires',async()=>{
  const session=storage(),landing=page('?utm_source=Telegram&utm_campaign=Launch',session);await landing.flush();
  const p=page('',session,1700000001000,'123456');await p.flush();
  const a={href:'https://apps.apple.com/app/id6794848328?mt=8#details'},original=a.href;
  p.click(a);const url=new URL(a.href);
  assert.equal(url.searchParams.get('pt'),'123456');assert.equal(url.searchParams.get('ct'),'telegram-launch-21beacb3');
  assert.equal(url.searchParams.get('mt'),'8');assert.equal(url.hash,'#details');assert.equal(url.searchParams.has('utm_source'),false);
  p.advance(31*60000);p.click(a);await p.flush();assert.equal(a.href,original);
  assert.equal(p.events().at(-1).properties.source,undefined);
  const long=page('?utm_source='+('s'.repeat(64))+'&utm_campaign='+('c'.repeat(64)),storage(),1700000000000,'123');await long.flush();
  const ct=new URL(long.click('https://apps.apple.com/app/id6794848328').href).searchParams.get('ct');
  assert.equal(ct.length,40);assert.match(ct,/^[a-z0-9_.-]+$/);
  const variant=page('?utm_source='+('s'.repeat(64))+'&utm_campaign=different',storage(),1700000000000,'123');await variant.flush();
  assert.notEqual(new URL(variant.click('https://apps.apple.com/app/id6794848328').href).searchParams.get('ct'),ct);
});
test('APK links carry only the five safe session tags, preserve referral codes and stop carrying expired tags',async()=>{
  const p=page('?utm_source=Telegram&utm_medium=Social&utm_campaign=Launch&utm_content=Bio&utm_term=Fitness&email=person%40example.com');await p.flush();
  const a={href:'https://releases.appfita.ru/?ref=ABCD2345&utm_source=old&UTM_CAMPAIGN=old#android'};
  const original=a.href;p.click(a);const url=new URL(a.href);
  assert.deepEqual([...url.searchParams.entries()],[['ref','ABCD2345'],['utm_source','telegram'],['utm_medium','social'],['utm_campaign','launch'],['utm_term','fitness'],['utm_content','bio']]);
  assert.equal(url.hash,'#android');assert.doesNotMatch(a.href,/example|email|UTM_CAMPAIGN|old/);
  p.advance(31*60000);p.click(a);assert.equal(a.href,original);
});
test('a fresh referral without its own tags clears the former campaign before server resolution',async()=>{
  const session=storage(),old=page('?utm_source=telegram&utm_campaign=old',session);await old.flush();
  const invite=page('?ref=SPRING26',session,1700000001000);await invite.flush();
  const props=invite.events()[0].properties;
  assert.equal(props.referral_code,'SPRING26');assert.equal(props.source,undefined);assert.equal(props.campaign,undefined);
  assert.equal(invite.click('https://releases.appfita.ru/').href,'https://releases.appfita.ru/');
  const explicit=page('?ref=SPRING26&utm_source=partner',session,1700000002000);await explicit.flush();
  assert.equal(explicit.events()[0].properties.source,'partner');
  assert.equal(explicit.events()[0].properties.campaign,undefined);
});
test('Apple campaign tokens distinguish joined-label collisions and source-only vs campaign-only visits',async()=>{
  const tokens=[];
  for(const search of ['?utm_source=partner-one&utm_campaign=launch','?utm_source=partner&utm_campaign=one-launch','?utm_source=telegram','?utm_campaign=telegram']){
    const p=page(search,storage(),1700000000000,'123456');await p.flush();
    tokens.push(new URL(p.click('https://apps.apple.com/app/id6794848328').href).searchParams.get('ct'));
  }
  assert.equal(new Set(tokens).size,4);
  assert.ok(tokens.every(ct=>ct.length<=40&&/^[a-z0-9_.-]+$/.test(ct)));
});
test('middle-click downloads are decorated and counted; context-menu clicks are ignored',async()=>{
  const p=page('?utm_source=telegram&utm_campaign=launch',storage(),1700000000000,'123456');await p.flush();
  const href='https://apps.apple.com/app/id6794848328';
  assert.equal(p.click(href,'auxclick',2).href,href);
  const a=p.click(href,'auxclick',1);await p.flush();
  assert.equal(new URL(a.href).searchParams.get('ct'),'telegram-launch-21beacb3');
  assert.equal(p.events().filter(e=>e.name==='download_clicked').length,1);
});
