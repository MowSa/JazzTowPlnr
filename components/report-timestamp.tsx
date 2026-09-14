'use client';
import { useEffect,useState } from 'react';
import { flushSync } from 'react-dom';
import { stationTimezone } from '@/lib/console';
export function ReportTimestamp({station}:{station:string}){
 const [stamp,setStamp]=useState('');
 useEffect(()=>{const format=()=>new Intl.DateTimeFormat('en-GB',{timeZone:stationTimezone(station)||'UTC',dateStyle:'medium',timeStyle:'short'}).format(Date.now());const timer=setTimeout(()=>setStamp(format()),0);const update=()=>flushSync(()=>setStamp(format()));window.addEventListener('beforeprint',update);return()=>{clearTimeout(timer);window.removeEventListener('beforeprint',update);};},[station]);
 return <span>Generated {stamp||'—'} {stationTimezone(station)?'local':'UTC'}</span>;
}
