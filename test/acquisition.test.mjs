import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../analytics.js',import.meta.url),'utf8');
const product='fita', host='appfita.ru', apiName=product.toUpperCase()+'_ANALYTICS';
const source=p=>p.utm_source??p.source;
const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
function page(search='',session=storage(),now=1700000000000,providerToken='') {
  const calls=[],timers=[],handlers={};let seq=0;
  const loc=new URL('https://'+host+'/'+search);
  const doc={readyState:'complete',referrer:'',title:'Home',visibilityState:'visible',documentElement:{scrollHeight:1000},currentScript:{getAttribute:k=>({'data-api':'https://api.appfita.ru','data-collect':'1'})[k]},querySelectorAll:()=>[],querySelector:()=>null,addEventListener:(n,f)=>{handlers[n]=f}};
  const win={document:doc,location:loc,localStorage:storage(),sessionStorage:session,URL,URLSearchParams,navigator:{language:'en'},screen:{width:100,height:100},innerWidth:100,innerHeight:100,history:{pushState(){},replaceState(){}},addEventListener:(n,f)=>{handlers[n]=f},crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`},setTimeout:f=>{timers.push(f);return timers.length},fetch:async(url,opts)=>{calls.push(JSON.parse(opts.body));return{status:204}}};
  const clock=class extends Date{static now(){return now}};
  const configured=code.replace("var APP_STORE_PROVIDER_TOKEN = '';",'var APP_STORE_PROVIDER_TOKEN = '+JSON.stringify(providerToken)+';');
  vm.runInNewContext(configured,{window:win,URL,URLSearchParams,Date:clock,Intl,Uint8Array,Blob,setTimeout:win.setTimeout,clearTimeout(){}});
  const flush=async()=>{let guard=0;while(timers.length&&guard++<10){timers.shift()();await Promise.resolve()}};
  return{win,flush,calls,events:()=>calls.flatMap(c=>c.events),advance:ms=>{now+=ms},click:href=>{const a=typeof href==='string'?{href}:href;handlers.click?.({target:{closest:()=>a},preventDefault(){throw new Error('Navigation must not be blocked')}});return a;},navigate:s=>{win.location=new URL('https://'+host+'/'+s);handlers.popstate?.()}};
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
  assert.equal(url.searchParams.get('pt'),'123456');assert.equal(url.searchParams.get('ct'),'telegram-launch');
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
