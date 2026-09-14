'use client';
import { PlaneLanding, PlaneTakeoff } from 'lucide-react';
import { Table,TableHeader,TableHead,TableRow,TableBody,TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { GateCheck } from '@/lib/gates';
const statusLabel={match:'Match',mismatch:'Different gate',unmatched:'Flight not found',ambiguous:'Conflicting assignments',missing:'Missing gate or date'};
export function GateMismatchTable({checks,onFin}:{checks:GateCheck[];onFin?:(fin:string)=>void}){
 return <Table className="gate-comparison-table"><TableHeader><TableRow>{['FIN','FLIGHT / DATE','MOVEMENT','TURN-VIEW GATE','AIRPORT GATE'].map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{checks.map(c=><TableRow key={c.id}><TableCell className="fin">{onFin?<Button variant="link" className="fin-link" onClick={()=>onFin(c.fin)}>{c.fin}</Button>:c.fin}</TableCell><TableCell><strong>{c.flight}</strong><small>{c.date||'Date missing'}</small></TableCell><TableCell><span className="movement-label">{c.direction==='arrival'?<PlaneLanding size={16}/>:<PlaneTakeoff size={16}/>} {c.direction==='arrival'?'Arrival':'Departure'}</span></TableCell><TableCell><Badge variant="outline" className="comparison-gate">{c.csvGate||'—'}</Badge></TableCell><TableCell><Badge variant="outline" className={`comparison-gate ${c.status==='mismatch'?'gate-different':''}`}>{c.airportGate||'—'}</Badge>{c.status!=='mismatch'&&c.status!=='match'&&<small>{statusLabel[c.status]}</small>}</TableCell></TableRow>)}</TableBody></Table>;
}
