import { moveErrors,type Move } from './tows.ts';
export type BoardFilter='all'|'review'|'progress'|'completed';
export function towStatus(move:Move,date:string):'excluded'|'review'|'ready'|'progress'|'completed'{
 if(!move.included)return 'excluded';
 if(/^([01]\d|2[0-3]):[0-5]\d$/.test(move.actualDrop))return 'completed';
 if(/^([01]\d|2[0-3]):[0-5]\d$/.test(move.actualPickup))return 'progress';
 return !move.reviewed||moveErrors(move,date).length?'review':'ready';
}
export const statusNames={excluded:'Excluded',review:'Awaiting review',ready:'Ready',progress:'In progress',completed:'Completed'};
export function stationTimezone(station:string){const zones:Record<string,string>={YYZ:'America/Toronto',YUL:'America/Toronto',YOW:'America/Toronto',YQB:'America/Toronto',YTZ:'America/Toronto',YVR:'America/Vancouver',YYC:'America/Edmonton',YEG:'America/Edmonton',YWG:'America/Winnipeg',YHZ:'America/Halifax',YQM:'America/Moncton',YFC:'America/Moncton',YYT:'America/St_Johns',YQX:'America/St_Johns',YXE:'America/Regina',YQR:'America/Regina'};return zones[station]||null;}
/** Station wall-clock time encoded the same way as tow times (UTC date with local clock). */
export function stationWallClockStamp(nowMs:number,station:string,day:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
 const tz=stationTimezone(station)||'UTC';
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(nowMs));
 const get=(type:string)=>parts.find(part=>part.type===type)?.value||'';
 if(`${get('year')}-${get('month')}-${get('day')}`!==day)return null;
 return Date.parse(`${day}T${get('hour')}:${get('minute')}:00Z`);
}
