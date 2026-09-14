import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,makeMoves,longMoves,moveErrors,gateArea,gate,towLocation,parseCSV,stamp,clock,roundPickup,exportCSV,planIssues} from '../lib/tows.ts';
import {sampleCSV} from './fixtures/sample.ts';
const header='Incoming,,,,,,,,Outgoing,,,,,\nOrigin,TOD,TOA,PAX,Flight,"Terminal\n/ Gate",Tail,"Turn Time\n(HH:MM)","Terminal\n/ Gate",Flight,PAX,TOD,TOA,Destination\n';
function fixture(row:string,date='05Sep26'){return header+row+`\n"Report Parameters (in Detail) :\nReport Period: ${date} 00:00 - ${date} 23:59 LT\nStation: YUL"`;}
const row=(arrival='0800/05 S',departure='1100/05 S',from='/ 02',to='/ A2',duration='03:00')=>`YTZ,0700/05 S,${arrival},,QK 1,${from},431,${duration},${to},QK 2,,${departure},,YTZ`;
test('attached September 5 report produces expected classification and pickup times',()=>{
 const r=analyze(sampleCSV);assert.equal(r.date,'2026-09-05');assert.equal(r.station,'YUL');assert.equal(r.turns.length,53);assert.equal(r.cancelled,6);
 const count=(k:string)=>r.turns.filter(t=>t.kind===k).length;
 assert.deepEqual([count('gate'),count('bse-in'),count('bse-out'),count('long'),count('none'),count('incomplete'),count('same-area')],[2,6,0,1,43,0,1]);
 const ms=makeMoves(r);assert.equal(ms.length,8);assert.equal(ms.find(m=>m.fin==='427')?.pickup,'17:40');assert.ok(!ms.some(m=>['431','713'].includes(m.fin)));
 assert.ok(ms.every(m=>moveErrors(m,r.date).length===0));assert.ok(r.turns.find(t=>t.fin==='526'&&t.kind==='bse-in')?.warnings.some(w=>w.includes('two days')));
});
test('gate prefixes and leading zeroes normalize; suffixes remain meaningful',()=>{assert.equal(gate('/ C74'),'74');assert.equal(gate('/ A2'),'02');assert.equal(gate('02'),'02');assert.equal(gate('/ 12A'),'12A');assert.equal(gate('/'),'');assert.equal(gate('BSE'),'BSE');});
test('scheduled pickups round to the nearest five-minute interval',()=>{assert.equal(clock(roundPickup(stamp('1802/05 S','2026-09-05'))),'18:00');assert.equal(clock(roundPickup(stamp('1803/05 S','2026-09-05'))),'18:05');const r=analyze(fixture(row('1803/05 S','2100/05 S','/ 02','/ 75','02:57')));assert.equal(makeMoves(r)[0].pickup,'18:05');});
test('holding stand identifiers preserve their alphabetic prefix',()=>{assert.equal(towLocation('S4B'),'S4B');assert.equal(towLocation('A2'),'02');const t=analyze(fixture(row('0800/05 S','1400/05 S','/ 02','/ A2','06:00'))).turns[0];const ms=longMoves(t,'S4B');assert.deepEqual(ms.map(m=>[m.from,m.to]),[['02','S4B'],['S4B','02']]);assert.equal(planIssues(ms).length,0);});
test('3 hours is not a tow; strictly above 3 hours is a candidate',()=>{assert.equal(analyze(fixture(row())).turns[0].kind,'none');assert.equal(analyze(fixture(row('0800/05 S','1101/05 S','/ 02','/ A2','03:01'))).turns[0].kind,'long');});
test('cross-area gates remain a direct tow even for a long turn',()=>{assert.equal(analyze(fixture(row('0800/05 S','1300/05 S','/ 02','/ 75','05:00'))).turns[0].kind,'gate');});
test('an actual departure in column L means a tow is no longer required',()=>{const actual=analyze(fixture(row('0800/05 A','1100/05 A','/ 02','/ 25','03:00')));assert.equal(actual.turns[0].kind,'none');assert.match(actual.turns[0].reason,/actual/i);assert.equal(makeMoves(actual).length,0);assert.equal(analyze(fixture(row('0800/05 A','1100/05 E','/ 02','/ 25','03:00'))).turns[0].kind,'same-area');});
test('long stay decision creates two timed moves with holding location validation',()=>{const t=analyze(fixture(row('0800/05 S','1400/05 S','/ 02','/ A2','06:00'))).turns[0];assert.throws(()=>longMoves(t,''));assert.throws(()=>longMoves(t,'A2'));const ms=longMoves(t,'BSE');assert.deepEqual(ms.map(m=>[m.from,m.to,m.pickup]),[['02','BSE','08:00'],['BSE','02','13:00']]);});
test('overnight same-gate turn is BSE, without a phantom gate change',()=>{const r=analyze(fixture(row('2200/04 S','0700/05 S','/ 02','/ A2','09:00')));assert.equal(r.turns[0].kind,'bse-out');const m=makeMoves(r)[0];assert.equal(m.arrFlight,'');assert.equal(m.pickup,'06:00');});
test('month and year boundaries resolve correctly',()=>{assert.equal(new Date(stamp('2200/31 S','2026-09-01')!).toISOString(),'2026-08-31T22:00:00.000Z');assert.equal(new Date(stamp('0600/01 S','2026-12-31')!).toISOString(),'2027-01-01T06:00:00.000Z');assert.equal(analyze(fixture(row('2200/31 S','0700/01 S','/ 02','/ 02','09:00'),'01Sep26')).turns[0].kind,'bse-out');});
test('pickup on previous day is flagged and not silently printed on the wrong sheet',()=>{const r=analyze(fixture(row('2100/04 S','0030/05 S','/ 02','/ 25','03:30')));const m=makeMoves(r)[0];assert.equal(m.pickup,'');assert.ok(m.warnings[0].includes('outside'));assert.ok(moveErrors(m,r.date).length);});
test('cancelled rows skipped, duplicate rows counted, missing aircraft marked incomplete',()=>{const csv=fixture(row()+'\n'+row()+'\n'+row().replace(',431,',',#CNL,')+'\n'+row().replace(',431,',',-,').replace('QK 1','QK 3'));const r=analyze(csv);assert.equal(r.cancelled,1);assert.equal(r.duplicates,1);assert.equal(r.turns.length,2);assert.equal(r.turns[1].kind,'incomplete');});
test('missing gates and impossible turn chronology require review',()=>{assert.equal(analyze(fixture(row('0800/05 S','1000/05 S','/','/ A2','02:00'))).turns[0].kind,'incomplete');assert.equal(analyze(fixture(row('1200/05 S','1000/05 S'))).turns[0].kind,'incomplete');});
test('parser handles BOM, CRLF, multiline fields, escaped quotes and rejects bad schema',()=>{assert.deepEqual(parseCSV('\uFEFFa,"b\nc","d""e"\r\n1,2,3'),[['a','b\nc','d"e'],['1','2','3']]);assert.throws(()=>parseCSV('"unclosed'));assert.throws(()=>analyze('a,b,c'));assert.throws(()=>analyze(header+row()));assert.equal(analyze(header+row(),'2026-09-05').date,'2026-09-05');assert.throws(()=>analyze(header+row(),'2026-02-31'));});
test('invalid and out-of-window pickup times are caught before review',()=>{const r=analyze(fixture(row('0800/05 S','1000/05 S','/02','/75','02:00')));const m=makeMoves(r)[0];assert.ok(moveErrors({...m,pickup:'07:59'},r.date).some(e=>e.includes('before aircraft')));assert.ok(moveErrors({...m,pickup:'10:00'},r.date).length);assert.ok(moveErrors({...m,pickup:'25:00'},r.date).length);assert.ok(moveErrors({...m,release:'08:15'},r.date).length);});
test('manual tow moves require FIN, from, to and scheduled pickup',()=>{const m={id:'manual-1',turnId:'',fin:'',arrFlight:'',depFlight:'',from:'',to:'',pickup:'',release:'',gateOpen:'',actualPickup:'',actualDrop:'',depTime:'',tower:'',kind:'manual' as const,included:true,reviewed:false,reason:'Manually added tow move',earliest:null,latest:null,warnings:[]};const errors=moveErrors(m,'2026-09-05');assert.ok(errors.some(e=>e.includes('Aircraft number')));assert.ok(errors.some(e=>e.includes('Both tow locations')));assert.ok(errors.some(e=>e.includes('pickup time')));assert.deepEqual(moveErrors({...m,fin:'431',from:'S4B',to:'25',pickup:'12:30'},'2026-09-05'),[]);});
test('export matches tow sheet columns, escapes CSV and spreadsheet formulas',()=>{const r=analyze(sampleCSV);const ms=makeMoves(r);ms[0].tower='=CMD("x")';const csv=exportCSV(r,ms,true);const rows=parseCSV(csv);assert.equal(rows[0][0],'TOW SHEET');assert.equal(rows[0][3],'DRAFT — REVIEW REQUIRED');assert.equal(rows[1].length,12);assert.ok(rows[2][11].startsWith("'="));assert.equal(rows[2][4],ms[0].pickup.replace(':',''));});

test('holding pairs cannot be issued with missing, reversed or disconnected return moves',()=>{const t=analyze(fixture(row('0800/05 S','1400/05 S','/ 02','/ A2','06:00'))).turns[0];const ms=longMoves(t,'BSE');assert.equal(planIssues(ms).length,0);assert.ok(planIssues([{...ms[0],included:false},ms[1]]).length);assert.ok(planIssues([ms[0],{...ms[1],pickup:'07:00'}]).length);assert.ok(planIssues([ms[0],{...ms[1],from:'25'}]).length);});

test('gate area boundaries, prefixes, unknown gates and holding identifiers',()=>{
 for(const g of ['56','57','58','73','75','89','C74'])assert.equal(gateArea(g),'US',g);
 for(const g of ['1','01','A2','25','49'])assert.equal(gateArea(g),'Domestic',g);
 for(const g of ['0','50','55','59','72','90','','BSE','S4B','S73','74A'])assert.equal(gateArea(g),null,g);
});
test('same-area changes need a route decision, without inventing a holding location',()=>{
 for(const [a,b] of [['73','75'],['56','89'],['1','49']]){const r=analyze(fixture(row('0800/05 S','1200/05 S',a,b,'04:00')));assert.equal(r.turns[0].kind,'same-area');assert.equal(makeMoves(r).length,0);}
 for(const [a,b] of [['49','56'],['58','1'],['50','55'],['72','73']])assert.equal(analyze(fixture(row('0800/05 S','1200/05 S',a,b,'04:00'))).turns[0].kind,'gate');
});
test('73 to 75 via S4B forms a valid pair with distinct flight gates',()=>{
 const r=analyze(fixture(row('0800/05 S','1200/05 S','73','75','04:00'))),t=r.turns[0];const ms=longMoves(t,'S4B');
 assert.deepEqual(ms.map(m=>[m.from,m.to,m.pickup,m.kind]),[['73','S4B','08:00','same-area'],['S4B','75','11:00','same-area']]);assert.deepEqual(planIssues(ms),[]);assert.ok(ms.every(m=>moveErrors(m,r.date).length===0));
 assert.throws(()=>longMoves(t,'C73'));assert.throws(()=>longMoves(t,'C75'));
 assert.ok(planIssues([ms[0],{...ms[1],from:'S5'}]).length);assert.ok(planIssues([ms[0],{...ms[1],included:false}]).length);
 const direct=makeMoves({...r,turns:[{...t,kind:'gate'}]});assert.equal(direct.length,1);assert.deepEqual([direct[0].from,direct[0].to],['73','75']);
});
test('same-area review does not supersede completed departures, overnight BSE, or same-gate rules',()=>{
 assert.equal(analyze(fixture(row('0800/05 A','1200/05 A','73','75','04:00'))).turns[0].kind,'none');
 assert.equal(analyze(fixture(row('2200/05 S','0800/06 S','73','75','10:00'))).turns[0].kind,'bse-in');
 assert.equal(analyze(fixture(row('0800/05 S','1000/05 S','73','C73','02:00'))).turns[0].kind,'none');
 assert.equal(analyze(fixture(row('0800/05 S','1200/05 S','73','C73','04:00'))).turns[0].kind,'long');
});
