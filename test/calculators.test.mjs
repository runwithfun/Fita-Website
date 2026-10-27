import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { restingPulse, hrvReference, heartZones, readiness } from '../scripts/calculators.mjs';
test('resting pulse uses an adult reference, not invented sex/age targets',()=>{
  for(const age of [18,35,60,100])for(const sex of ['m','f'])assert.equal(restingPulse({age,sex,pulse:65}).status,'usual');
  assert.equal(restingPulse({age:35,pulse:48}).status,'low');
  assert.equal(restingPulse({age:35,pulse:100}).status,'usual');
  assert.equal(restingPulse({age:35,pulse:115}).status,'high');
  for(const age of [0,17,101,NaN])assert.equal(restingPulse({age,pulse:65}).status,'invalid');
});
test('KORA references preserve metric, sex and study age boundaries',()=>{
  assert.deepEqual(hrvReference({age:25,sex:'f',metric:'sdnn',value:48.7}),{status:'typical',mean:48.7,low:29.7,high:67.7});
  assert.equal(hrvReference({age:74,sex:'m',metric:'rmssd',value:20}).mean,19.1);
  assert.equal(hrvReference({age:35,sex:'m',metric:'sdnn',value:40}).mean,44.6);
  assert.equal(hrvReference({age:25,sex:'f',metric:'sdnn',value:29.8}).status,'typical');
  assert.equal(hrvReference({age:25,sex:'f',metric:'sdnn',value:67.8}).status,'above');
  assert.equal(hrvReference({age:25,sex:'f',metric:'sdnn',value:29.7}).status,'typical');
  for(const age of [18,24,34.5,75,100])assert.equal(hrvReference({age,sex:'f',metric:'sdnn',value:40}).status,'invalid');
});
test('zones distinguish maximum fractions from reserve fractions',()=>{
  const normal=heartZones({age:35});assert.equal(normal.max,184);assert.deepEqual(normal.zones[1],{zone:2,low:110,high:128});
  const reserve=heartZones({age:35,method:'hrr',resting:60});assert.deepEqual(reserve.zones[1],{zone:2,low:134,high:146});
  assert.deepEqual(heartZones({age:35,method:'measured',max:200}).zones[1],{zone:2,low:120,high:140});
  assert.equal(heartZones({age:35,method:'hrr',resting:200}).status,'invalid');
});
test('readiness matches FITA component rounding and missing data coverage',()=>{
  const full=readiness({hrv:50,baseline:50,sleepMin:480,resting:60,restingAverage:60});assert.equal(full.score,100);assert.equal(full.coverage,100);
  assert.equal(readiness({hrv:50,baseline:50}).score,null);
  assert.equal(readiness({resting:60,restingAverage:60}).score,null);
  const missing=readiness({sleepMin:480,resting:60,restingAverage:60});assert.equal(missing.score,100);assert.equal(missing.coverage,55);
  const low=readiness({hrv:30,baseline:50,sleepMin:240,awakeMin:60,resting:69,restingAverage:60});assert.equal(low.score,14);assert.equal(low.status,'rest');
  const partial=readiness({hrv:40,baseline:50,resting:63,restingAverage:60});assert.equal(partial.score,55);assert.equal(partial.coverage,65);
  assert.equal(readiness({}).status,'insufficient');
});
test('calculator module contains no network or persistence API',()=>{
  const code=fs.readFileSync(new URL('../scripts/calculators.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(code,/fetch\s*\(|sendBeacon|localStorage|sessionStorage|XMLHttpRequest|indexedDB/);
});
