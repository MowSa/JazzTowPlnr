import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,makeMoves} from '../lib/tows.ts';
import {sampleCSV} from './fixtures/sample.ts';
import {towStatus,stationTimezone} from '../lib/console.ts';
const report=analyze(sampleCSV),move=makeMoves(report)[0];
void test('execution follows actual pickup and drop, never scheduled time',()=>{
 assert.equal(towStatus({...move,reviewed:false},report.date),'review');
 assert.equal(towStatus({...move,reviewed:true},report.date),'ready');
 assert.equal(towStatus({...move,actualPickup:'18:00'},report.date),'progress');
 assert.equal(towStatus({...move,actualPickup:'18:00',actualDrop:'18:15'},report.date),'completed');
 assert.equal(towStatus({...move,actualDrop:'00:00'},report.date),'completed');
 assert.equal(towStatus({...move,actualDrop:'25:00',reviewed:false},report.date),'review');
 assert.equal(towStatus({...move,included:false,actualDrop:'18:15'},report.date),'excluded');
 assert.equal(towStatus({...move,reviewed:true,pickup:''},report.date),'review');
});
void test('station clocks use station zone with daylight saving support',()=>{
 assert.equal(stationTimezone('YYZ'),'America/Toronto');
 assert.equal(stationTimezone('YUL'),'America/Toronto');
 assert.equal(stationTimezone('YVR'),'America/Vancouver');
 assert.equal(stationTimezone('UNKNOWN'),null);
 const hour=(date:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:stationTimezone('YYZ')!,hour:'2-digit',hourCycle:'h23'}).format(new Date(date));
 assert.equal(hour('2026-09-07T12:00:00Z'),'08');
 assert.equal(hour('2026-01-07T12:00:00Z'),'07');
});
