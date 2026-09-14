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
