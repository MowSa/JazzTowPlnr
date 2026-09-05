export type Kind = 'gate' | 'bse-in' | 'bse-out' | 'long' | 'none' | 'incomplete';
export type Turn = {id:string; row:number; fin:string; arrFlight:string; depFlight:string; origin:string; destination:string; from:string; to:string; rawFrom:string; rawTo:string; arrival:number|null; departure:number|null; arrLabel:string; depLabel:string; duration:number|null; kind:Kind; reason:string; warnings:string[]};
export type Report = {date:string; station:string; turns:Turn[]; cancelled:number; duplicates:number; warnings:string[]};
export type Move = {id:string;turnId:string;fin:string;arrFlight:string;depFlight:string;from:string;to:string;pickup:string;release:string;gateOpen:string;actualPickup:string;actualDrop:string;depTime:string;tower:string;kind:Kind;included:boolean;reviewed:boolean;reason:string;earliest:number|null;latest:number|null;warnings:string[]};
export const DAY=86400000;
export function parseCSV(text:string):string[][] {
 const rows:string[][]=[]; let row:string[]=[], value='', quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++) {const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else if(quoted){quoted=false;}else if(!value){quoted=true;}else {value+=c;}}else if(c===','&&!quoted){row.push(value.trim());value='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value.trim());if(row.some(Boolean))rows.push(row);row=[];value='';}else value+=c;}
 if(quoted)throw Error('The CSV has an unclosed quoted field. Please export the schedule again.');
 row.push(value.trim());if(row.some(Boolean))rows.push(row);return rows;
}
export function gate(v:string){let s=(v.split('/').pop()||'').trim().toUpperCase();if(['','-','N/A'].includes(s))return '';s=s.replace(/^[A-Z]+(?=\d)/,'');return /^\d+$/.test(s)?String(Number(s)).padStart(2,'0'):s;}
export function clock(t:number|null){if(t===null)return '';return new Date(t).toISOString().slice(11,16);}
export function timeLabel(t:number|null,date:string){if(t===null)return '—';const d=new Date(t).toISOString().slice(0,10);return clock(t)+(d!==date?' · '+d.slice(5):'');}
export function stamp(value:string,date:string):number|null {
 const m=/^(\d{2})(\d{2})\/(\d{2})(?:\s+[A-Z])?$/.exec(value.trim());if(!m||+m[1]>23||+m[2]>59||+m[3]<1||+m[3]>31)return null;
 const base=new Date(date+'T12:00:00Z');const candidates=[-1,0,1].map(offset=>Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+offset,+m[3],+m[1],+m[2])).filter(t=>new Date(t).getUTCDate()===+m[3]);
 return candidates.sort((a,b)=>Math.abs(a-base.getTime())-Math.abs(b-base.getTime()))[0]??null;
}
const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
export function analyze(text:string,dateOverride?:string):Report {
 const rows=parseCSV(text); const header=rows.findIndex(r=>r.length===14&&r[0]==='Origin'&&r[6]==='Tail'&&r[13]==='Destination');
 if(header<0)throw Error('This is not a supported turn-view CSV. Expected Incoming / Outgoing columns with Origin, TOA, Tail and Destination.');
 const dateMatch=/Report Period:\s*(\d{2})([A-Za-z]{3})(\d{2,4})/i.exec(text);
 const mon=dateMatch?months.indexOf(dateMatch[2].toLowerCase()):-1;
 const inferred=dateMatch&&mon>=0?`${dateMatch[3].length===2?'20':''}${dateMatch[3]}-${String(mon+1).padStart(2,'0')}-${dateMatch[1]}`:'';
 const date=dateOverride||inferred;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('The CSV is missing a valid report date. Set the operating date and upload it again.');
 const station=/Station:\s*([A-Z0-9]+)/.exec(text)?.[1]||'Station';
 const start=Date.parse(date+'T00:00:00Z'),end=start+DAY;const report:Report={date,station,turns:[],cancelled:0,duplicates:0,warnings:[]};const seen=new Set<string>();
 for(let i=header+1;i<rows.length;i++){
 const r=rows[i];if(r[0].startsWith('Report Parameters'))break;
 if(r.length!==14){report.warnings.push(`Row ${i+1}: expected 14 columns; row not analyzed.`);continue;}
 if(r.some(s=>/#CNL|\bCANCELLED\b/i.test(s))){report.cancelled++;continue;}
 const key=JSON.stringify(r);if(seen.has(key)){report.duplicates++;continue;}seen.add(key);
 const arrival=stamp(r[2],date),departure=stamp(r[11],date);const aToday=arrival!==null&&arrival>=start&&arrival<end,dToday=departure!==null&&departure>=start&&departure<end;
 const warnings:string[]=[];let duration=arrival!==null&&departure!==null?(departure-arrival)/60000:null;
 const turnDuration=/^(\d+):(\d{2})$/.exec(r[7]);if(duration!==null&&turnDuration&&Math.abs(duration-(+turnDuration[1]*60 + +turnDuration[2]))>5)warnings.push('Displayed turn time differs from arrival/departure times.');
 if(duration!==null&&duration<0)warnings.push('Departure precedes arrival. Verify these dates.');
 if(duration!==null&&duration>48*60)warnings.push('Next departure is more than two days later. Verify the aircraft assignment.');
 const from=gate(r[5]),to=gate(r[8]);let kind:Kind='none',reason='Same gate · within 3 hours';
 const fin=r[6]==='-'?'':r[6];
 if(!fin||arrival===null||departure===null||duration!==null&&duration<0){kind='incomplete';reason='Incomplete or inconsistent aircraft/timing data. Confirm this turn manually.';}
 else if(dToday&&arrival<start){kind='bse-out';reason='First departure after an overnight stay. Confirm the aircraft is at BSE.';}
 else if(aToday&&departure>=end){kind='bse-in';reason='Next departure is on a later day. Tow to BSE after arrival.';}
 else if(!aToday&&!dToday){reason='Outside this operating day';}
 else if(!from||!to){kind='incomplete';reason='Missing gate. Enter the tow route after checking the gate assignment.';}
 else if(from!==to){kind='gate';reason=`Arrival gate ${from} differs from departure gate ${to}.`;}
 else if(duration!==null&&duration>180){kind='long';reason=`Same gate for ${Math.floor(duration/60)}h ${duration%60}m. Decide whether to tow and choose a holding stand.`;}
 if(kind==='bse-out'&&!to||kind==='bse-in'&&!from)warnings.push('Missing gate for the tow route.');
 if(arrival===null&&r[2])warnings.push(`Unrecognized arrival time: ${r[2]}`);
 if(departure===null&&r[11])warnings.push(`Unrecognized departure time: ${r[11]}`);
 report.turns.push({id:`turn-${i+1}`,row:i+1,fin,arrFlight:r[4]==='-'?'':r[4],depFlight:r[9]==='-'?'':r[9],origin:r[0],destination:r[13],from,to,rawFrom:r[5],rawTo:r[8],arrival,departure,arrLabel:r[2],depLabel:r[11],duration,kind,reason,warnings});
 }
 if(!report.turns.length&&!report.cancelled)throw Error('No flight turns were found in this file.');
 return report;
}
export function makeMoves(report:Report):Move[]{
 const start=Date.parse(report.date+'T00:00:00Z'),end=start+DAY;
 return report.turns.filter(t=>['gate','bse-in','bse-out','incomplete'].includes(t.kind)).map(t=>{
 const outbound=t.kind==='bse-out',inbound=t.kind==='bse-in';const pickup=outbound&&t.departure!==null?t.departure-60*60000:t.arrival;const outside=pickup!==null&&(pickup<start||pickup>=end);
 const warnings=[...t.warnings];if(outside)warnings.push('Calculated pickup falls outside the sheet date. Assign a pickup on this sheet date or coordinate on the adjacent day’s sheet.');
 return {id:t.id,turnId:t.id,fin:t.fin,arrFlight:outbound?'':t.arrFlight,depFlight:inbound?'':t.depFlight,from:outbound?'BSE':t.from,to:inbound?'BSE':t.to,pickup:outside?'':clock(pickup),release:'',gateOpen:'',actualPickup:'',actualDrop:'',depTime:inbound?'':clock(t.departure),tower:'',kind:t.kind,included:t.kind!=='incomplete',reviewed:false,reason:t.reason,earliest:outbound?null:t.arrival,latest:inbound?null:t.departure,warnings};
 });
}
export function longMoves(t:Turn,holding:string):Move[]{
 const stand=gate(holding);if(!stand||stand===t.from)throw Error('Choose a holding stand different from the arrival gate.');
 const base:Move={id:t.id,turnId:t.id,fin:t.fin,arrFlight:t.arrFlight,depFlight:'',from:t.from,to:stand,pickup:clock(t.arrival),release:'',gateOpen:'',actualPickup:'',actualDrop:'',depTime:'',tower:'',kind:'long',included:true,reviewed:false,reason:'Long stay · tow to holding stand',earliest:t.arrival,latest:t.departure,warnings:[...t.warnings]};
 return [{...base,id:t.id+'-out'},{...base,id:t.id+'-return',arrFlight:'',depFlight:t.depFlight,from:stand,to:t.to,pickup:clock(t.departure===null?null:t.departure-60*60000),depTime:clock(t.departure),reason:'Long stay · return to departure gate'}];
}
export function moveErrors(m:Move,date:string):string[]{
 const errors:string[]=[];
 if(!m.fin.trim())errors.push('Aircraft number is required.');if(!m.from.trim()||!m.to.trim())errors.push('Both tow locations are required.');else if(gate(m.from)===gate(m.to))errors.push('Tow locations must be different.');
 const validTime=(v:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
 if(!validTime(m.pickup))errors.push('A valid pickup time is required.');
 else {const p=Date.parse(`${date}T${m.pickup}:00Z`);if(m.earliest!==null&&p<m.earliest)errors.push('Pickup is before aircraft arrival.');if(m.latest!==null&&p>=m.latest)errors.push('Pickup must be before departure.');if(m.release&&validTime(m.release)&&m.pickup<m.release)errors.push('Pickup is before aircraft release.');}
 for(const field of ['release','gateOpen','actualPickup','actualDrop','depTime'] as const)if(m[field]&&!validTime(m[field]))errors.push(`Invalid time in ${field}.`);
 return errors;
}
export const sheetHeaders=['ARR FLT#','FIN #','TOW FROM','TOW TO','SKED PICKUP','AIRCRAFT RELEASE TIME / AT','TIME GATE OPENS AT','ACTUAL PICKUP','ACTUAL DROP','DEP FLT#','DEP TIME','Tower'];
export function sheetValues(m:Move){const f=(s:string)=>s.replace(/^QK\s*/,'');const tm=(s:string)=>s.replace(':','');return [f(m.arrFlight),m.fin,m.from,m.to,tm(m.pickup),tm(m.release),tm(m.gateOpen),tm(m.actualPickup),tm(m.actualDrop),f(m.depFlight),tm(m.depTime),m.tower];}
export function exportCSV(report:Report,moves:Move[],draft:boolean){const safe=(v:string)=>'"'+(/^[=+\-@\t\r]/.test(v)?"'"+v:v).replace(/"/g,'""')+'"';const rows=[['TOWER’S SHEET',report.date,report.station,draft?'DRAFT — REVIEW REQUIRED':'REVIEWED'],sheetHeaders,...moves.map(sheetValues)];return '\uFEFF'+rows.map(r=>r.map(safe).join(',')).join('\r\n');}
export function planIssues(moves:Move[]):string[]{
 const issues:string[]=[];const holding=moves.filter(m=>m.kind==='long');
 for(const id of new Set(holding.map(m=>m.turnId))){const pair=holding.filter(m=>m.turnId===id);const out=pair.find(m=>m.id.endsWith('-out')),back=pair.find(m=>m.id.endsWith('-return'));
 if(pair.some(m=>m.included)&&(!out?.included||!back?.included)){issues.push(`FIN ${pair[0].fin}: include both the holding tow and return tow, or exclude both.`);continue;}
 if(out?.included&&back?.included){if(out.pickup>=back.pickup)issues.push(`FIN ${out.fin}: holding tow must be before the return tow.`);if(gate(out.to)!==gate(back.from)||gate(out.from)!==gate(back.to)||out.fin!==back.fin)issues.push(`FIN ${out.fin}: the holding and return routes must match.`);}}
 return issues;
}
