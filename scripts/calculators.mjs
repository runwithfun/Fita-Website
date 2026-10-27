// Educational calculations; no inputs are stored or sent to a server.
export const KORA = [
  { from:25,to:34,f:{sdnn:[48.7,19],rmssd:[42.9,22.8]},m:{sdnn:[50,20.9],rmssd:[39.7,19.9]} },
  { from:35,to:44,f:{sdnn:[45.4,20.5],rmssd:[35.4,18.5]},m:{sdnn:[44.6,16.8],rmssd:[32,16.5]} },
  { from:45,to:54,f:{sdnn:[36.9,13.8],rmssd:[26.3,13.6]},m:{sdnn:[36.8,14.6],rmssd:[23,10.9]} },
  { from:55,to:64,f:{sdnn:[30.6,12.4],rmssd:[21.4,11.9]},m:{sdnn:[32.8,14.7],rmssd:[19.9,11.1]} },
  { from:65,to:74,f:{sdnn:[27.8,11.8],rmssd:[19.1,11.8]},m:{sdnn:[29.6,13.2],rmssd:[19.1,10.7]} },
];
const valid = (v,min,max) => typeof v === 'number' && Number.isFinite(v) && v>=min && v<=max;
export function restingPulse({age,pulse}) {
  if(!valid(age,18,100)||!valid(pulse,25,250)) return {status:'invalid'};
  return {status:pulse<60?'low':pulse>100?'high':'usual',low:60,high:100};
}
export function hrvReference({age,sex,metric,value}) {
  if(!valid(age,25,74)||!Number.isInteger(age)||!['f','m'].includes(sex)||!['sdnn','rmssd'].includes(metric)||!valid(value,1,500)) return {status:'invalid'};
  const band=KORA.find(b=>age>=b.from&&age<=b.to),[mean,sd]=band[sex][metric];
  const rawLow=Math.max(1,mean-sd),rawHigh=mean+sd;
  const low=Number(rawLow.toFixed(1)),high=Number(rawHigh.toFixed(1));
  return {status:value<rawLow-1e-12?'below':value>rawHigh+1e-12?'above':'typical',mean,low,high};
}
export function heartZones({age,method='tanaka',resting,max}) {
  if(!valid(age,18,81)||!['tanaka','fox','hrr','measured'].includes(method)) return {status:'invalid'};
  const peak=method==='fox'?220-age:method==='measured'?max:208-0.7*age;
  if(!valid(peak,80,250)||(method==='hrr'&&(!valid(resting,25,150)||resting>=peak))) return {status:'invalid'};
  const at=f=>Math.round(method==='hrr'?resting+(peak-resting)*f:peak*f);
  return {status:'estimate',max:Math.round(peak),zones:[.5,.6,.7,.8,.9].map((f,i)=>({zone:i+1,low:at(f),high:at(f+.1)}))};
}
// Matches Wellness.computeReadiness + Readiness.normalize: round components first.
export function readiness({hrv,baseline,sleepMin,awakeMin=0,goalHours=8,resting,restingAverage}) {
  const parts=[];
  if(valid(hrv,1,500)&&valid(baseline,1,500)&&Number.isInteger(hrv)&&Number.isInteger(baseline)) parts.push({key:'hrv',weight:45,points:Math.round(Math.min(1,Math.max(0,(hrv/baseline-.6)/.4))*45)});
  if(valid(sleepMin,1,1440)&&valid(awakeMin,0,1440)&&valid(goalHours,1,24)) parts.push({key:'sleep',weight:35,points:Math.round(Math.min(1,sleepMin/60/goalHours)*(sleepMin/(sleepMin+awakeMin))*35)});
  if(valid(resting,25,250)&&valid(restingAverage,25,250)) parts.push({key:'resting',weight:20,points:Math.round(Math.min(1,Math.max(0,1-(resting-restingAverage)/(restingAverage*.15)))*20)});
  const coverage=parts.reduce((n,p)=>n+p.weight,0);
  const score=coverage<50?null:Math.min(100,Math.round(parts.reduce((n,p)=>n+p.points,0)*100/coverage));
  return {status:score===null?'insufficient':score>=80?'high':score>=60?'normal':score>=40?'easy':'rest',score,coverage,parts};
}

if(typeof document!=='undefined') {
  const form=document.querySelector('[data-calculator]');
  if(form) {
    const strings=JSON.parse(document.getElementById('calculator-labels').textContent);
    const output=form.querySelector('output');
    const calc={pulse:restingPulse,hrv:hrvReference,zones:heartZones,readiness};
    const button=form.querySelector('button');
    const method=form.querySelector('select[name="method"]');
    if(method){const update=()=>{for(const label of form.querySelectorAll('[data-method]')){const active=label.dataset.method===method.value;label.hidden=!active;label.querySelector('input').disabled=!active;}};method.addEventListener('change',update);update();}
    form.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.matches('input,select')){event.preventDefault();button.click();}});
    button.addEventListener('click',()=>{
      for(const field of form.querySelectorAll('input,select'))if(!field.reportValidity())return;
      const data=Object.fromEntries([...form.querySelectorAll('input,select')].map(input=>[input.name,input.value]));
      for(const input of form.querySelectorAll('input[type="number"]')) data[input.name]=input.value.trim()===''?undefined:Number(input.value);
      const result=calc[form.dataset.calculator](data);
      output.replaceChildren();
      const p=document.createElement('p');p.textContent=strings[result.status]||strings.invalid;output.append(p);
      if(result.score!==undefined&&result.score!==null){const n=document.createElement('strong');n.textContent=`${result.score}/100`;output.prepend(n);const detail=document.createElement('p');detail.textContent=`${strings.coverage} ${result.coverage}%`;output.append(detail);}
      if(result.mean){const p=document.createElement('p');p.textContent=`${strings.mean} ${result.mean} ${strings.ms}. ${strings.range} ${result.low}–${result.high} ${strings.ms}.`;output.append(p);}
      if(result.zones){const table=document.createElement('table');const cap=document.createElement('caption');cap.textContent=strings.zoneTable;table.append(cap);for(const z of result.zones){const row=table.insertRow();row.insertCell().textContent=`${strings.zone} ${z.zone}`;row.insertCell().textContent=`${z.low}–${z.high} ${strings.bpm}`;}output.append(table);}
      output.hidden=false;
    });
  }
}
