import { DAY, clock, gateArea, towLocation, type Report, type Turn } from './tows.ts';
export type ShutdownRow = {fin:string; maintenance:boolean; gateAllowed:boolean; autoGate:boolean; ron:string; arrFlight:string; depFlight:string; std:string; grooming:boolean; tb:boolean|null; comments:string; warnings:string[]; eligible:boolean; requestedGate:string; requestStatus:'pending'|'approved'|'declined'|'none'; arrival:number|null; departure:number|null; reviewed:boolean};
export function parseFins(text:string):string[]{const values=text.trim()?text.trim().split(/[\s,;]+/):[];const invalid=values.filter(v=>!/^\d{1,6}$/.test(v));if(invalid.length)throw Error(`Use FIN numbers only, separated by spaces, commas or newlines. Check: ${invalid.slice(0,4).join(', ')}`);return [...new Set(values.map(v=>String(Number(v))))];}
export function nightWindow(date:string){const start=Date.parse(date+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(start)||new Date(start).toISOString().slice(0,10)!==date)throw Error('Choose a valid shutdown night.');return {start,end:start+DAY};}
export function buildShutdown(report:Report,date:string,requiredText:string,allowedText:string):ShutdownRow[]{
 const {start,end}=nightWindow(date);const required=parseFins(requiredText),allowed=parseFins(allowedText);const overlap=required.filter(f=>allowed.includes(f));if(overlap.length)throw Error(`FIN ${overlap.join(', ')} appears in both overnight lists. Resolve the conflict first.`);
 const fins=new Map<string,Turn[]>();for(const t of report.turns){if(!t.fin||!/^\d+$/.test(t.fin))continue;const fin=String(Number(t.fin));fins.set(fin,[...(fins.get(fin)||[]),t]);}
 const overnight=(t:Turn)=>t.arrival!==null&&t.arrival<end+8*3600000&&(t.departure===null?t.arrival>=start:t.departure>=end&&t.departure>t.arrival);
 const included=new Set([...required,...allowed,...[...fins].filter(([,ts])=>ts.some(overnight)).map(([fin])=>fin)]);
 return [...included].sort((a,b)=>Number(a)-Number(b)).map(fin=>{
 const turns=fins.get(fin)||[];const candidates=turns.filter(overnight).sort((a,b)=>(b.arrival||0)-(a.arrival||0));const t=candidates[0];const maintenance=required.includes(fin),gateAllowed=allowed.includes(fin);const warnings:string[]=[];
 if(!t)warnings.push('No matching overnight turn in this schedule. Confirm aircraft location and next flight.');
 if(candidates.length>1)warnings.push('More than one possible overnight turn. Latest arrival selected; verify assignment.');
 if(!maintenance&&!gateAllowed)warnings.push('FIN is not on either overnight list. HGR until maintenance confirms.');
 if(t?.departure===null)warnings.push('Next departure is missing.');
 const arrival=t?.arrival??null,departure=t?.departure??null;
 const eligible=!!(gateAllowed&&!maintenance&&arrival!==null&&departure!==null&&arrival>=start+21*3600000&&arrival<end+8*3600000&&departure>=end&&departure<=end+8*3600000&&departure>arrival);
 const minutes=departure===null?-1:Math.round((departure-end)/60000);const gate02=eligible&&minutes>=270&&minutes<=330;
 const requestedGate=eligible?(gate02?'02':towLocation(t?.from||'')):'';
 const tb=t?.depFlight?gateArea(t.to)==='US'?true:gateArea(t.to)==='Domestic'?false:null:null;
 if(tb===null)warnings.push('Next flight US/TB status is unknown. Confirm it manually.');
 else warnings.push(`US/TB inferred from departure gate ${t?.to}; confirm the destination ${t?.destination||''}.`);
 if(t?.depLabel&&!/\sS\s*$/.test(t.depLabel))warnings.push('Departure time is actual or estimated in this CSV; confirm STD.');
 const comments:string[]=[];
 if(departure!==null&&departure>=end+DAY)comments.push(`Next departure ${new Date(departure).toISOString().slice(0,10)}`);

 const grooming=turns.some(v=>[v.arrival,v.departure].some(time=>time!==null&&time>=start&&time<end))||arrival!==null&&arrival>=end&&arrival<end+8*3600000;
 return {fin,maintenance,gateAllowed,autoGate:gate02,ron:gate02?'02':'HGR',arrFlight:t?.arrFlight||'',depFlight:t?.depFlight||'',std:clock(departure),grooming,tb,comments:comments.join(' '),warnings,eligible,requestedGate,requestStatus:gate02?'approved':eligible?'pending':'none',arrival,departure,reviewed:false};
 });
}
export function updateGateRequest(row:ShutdownRow,status:ShutdownRow['requestStatus'],gate=row.requestedGate):ShutdownRow{
 if(status!=='none'&&(!row.eligible||row.maintenance))throw Error('This aircraft is not eligible for an overnight-gate request.');
 const location=towLocation(gate);if(status==='approved'&&(!location||!/^([1-9]\d{0,2}|0[1-9])[A-Z]?$/.test(location)))throw Error('Enter a valid gate number before confirming approval.');
 return {...row,autoGate:false,requestedGate:location,requestStatus:status,ron:status==='approved'?location:'HGR',reviewed:false};
}
export function shutdownComments(row:ShutdownRow){return [row.comments,row.requestStatus==='pending'?`Overnight gate ${row.requestedGate||'TBC'} REQUEST PENDING — RON remains HGR.`:row.requestStatus==='approved'?row.autoGate?`Overnight gate ${row.requestedGate} assigned automatically.`:`Overnight gate ${row.requestedGate} approved.`:row.requestStatus==='declined'?'Overnight gate declined — HGR.':''].filter(Boolean).join(' ');}
export const shutdownHeaders=['FIN','RON LOCATION','ARRIVAL FLIGHT','DEPARTURE FLIGHT','STD','ENTER X IF GROOMING IS REQUIRED','ENTER X IF NEXT PLANNED FLIGHT IS TB','COMMENTS'];
export function shutdownValues(r:ShutdownRow){const flight=(s:string)=>s.replace(/^QK\s*/,'');return [r.fin,r.ron,flight(r.arrFlight)||'-',flight(r.depFlight)||'-',r.std.replace(':','')||'-',r.grooming?'X':'',r.tb===null?'?':r.tb?'X':'',shutdownComments(r)];}
export function shutdownErrors(r:ShutdownRow){const errors:string[]=[];if(!r.ron.trim())errors.push('RON location is required.');if(r.maintenance&&r.ron!=='HGR')errors.push('Maintenance-required aircraft must remain at HGR.');if(r.tb===null)errors.push('Confirm whether the next flight is US/TB.');if(r.std&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.std))errors.push('STD must be a valid time.');if(r.requestStatus==='approved'&&!/^([1-9]\d{0,2}|0[1-9])[A-Z]?$/.test(r.requestedGate))errors.push('An assigned gate must be a valid gate number.');if(r.requestStatus==='approved'&&r.ron!==r.requestedGate)errors.push('RON must match the approved gate.');return errors;}
export function shutdownPlanErrors(rows:ShutdownRow[]){const gates=new Map<string,string[]>();for(const r of rows){if(r.ron==='HGR')continue;const key=towLocation(r.ron);gates.set(key,[...(gates.get(key)||[]),r.fin]);}return [...gates].filter(([,fins])=>fins.length>1).map(([gate,fins])=>`Gate ${gate} is assigned to FINs ${fins.join(', ')}. Confirm separate locations before finalizing.`);}
export function shutdownDraft(rows:ShutdownRow[]){return shutdownPlanErrors(rows).length>0||rows.some(r=>!r.reviewed||shutdownErrors(r).length>0||r.requestStatus==='pending');}
export function csvRows(rows:string[][]){const safe=(v:string)=>'"'+(/^[=+\-@\t\r]/.test(v)?"'"+v:v).replace(/"/g,'""')+'"';return '\uFEFF'+rows.map(row=>row.map(safe).join(',')).join('\r\n');}
export function shutdownCSV(rows:ShutdownRow[],date:string,station:string){return csvRows([['SHUTDOWN REPORT',date,station,shutdownDraft(rows)?'DRAFT — REVIEW REQUIRED':'REVIEWED'],shutdownHeaders,['REQUIRED BY MAINTENANCE'],...rows.filter(r=>r.maintenance).map(shutdownValues),['MAY REMAIN AT GATE'],...rows.filter(r=>!r.maintenance&&r.gateAllowed).map(shutdownValues),['OTHER OVERNIGHT AIRCRAFT'],...rows.filter(r=>!r.maintenance&&!r.gateAllowed).map(shutdownValues)]);}
export function requestsCSV(rows:ShutdownRow[],date:string){return csvRows([['OVERNIGHT GATE REQUESTS',date,'Preparation only — not sent'],['FIN','REQUESTED GATE','ARRIVAL','DEPARTURE','STATUS'],...rows.filter(r=>r.eligible).map(r=>[r.fin,r.requestedGate,r.arrival===null?'':new Date(r.arrival).toISOString().slice(0,16).replace('T',' '),r.departure===null?'':new Date(r.departure).toISOString().slice(0,16).replace('T',' '),r.autoGate?'AUTO ASSIGNED':r.requestStatus.toUpperCase()])]);}
