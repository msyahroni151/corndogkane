import { timeLabel, compareWarehouseSchedules } from "@/lib/schedules";
export type WarehouseScheduleData = {
  from: string;
  to: string;
  employees: { id: string; name: string }[];
  rows: {
    employeeId: string;
    date: string;
    status: string;
    shift: string | null;
    startMinutes: number | null;
    endMinutes: number | null;
  }[];
};
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
const longDate = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso + "T00:00:00Z"));

export function warehouseScheduleSvg(data: WarehouseScheduleData) {
  const first = new Date(data.from + 'T00:00:00Z'), last = new Date(data.to + 'T00:00:00Z');
  first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  const dates: string[] = [];
  while (first <= last || dates.length % 7 !== 0) { dates.push(first.toISOString().slice(0, 10)); first.setUTCDate(first.getUTCDate() + 1); }
  const width = 1400, margin = 20, cw = (width - margin * 2) / 7, parts: string[] = [];
  const rect = (x:number,y:number,w:number,h:number,fill:string) => parts.push('<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+fill+'" stroke="#dce5df"/>');
  const text = (s:string,x:number,y:number,size=14,bold=false,color='#294638') => parts.push('<text x="'+x+'" y="'+y+'" font-family="Arial,sans-serif" font-size="'+size+'" font-weight="'+(bold?700:400)+'" fill="'+color+'">'+escape(s)+'</text>');
  rect(margin, 16, width-margin*2, 82, '#3e5e4d');
  text('CORNDOG KANE · JADWAL CREW GUDANG',40,49,23,true,'#ffffff');
  text(longDate(data.from)+' – '+longDate(data.to),40,79,15,false,'#e2eee5');
  const fills: Record<string,string> = {S1:'#dceedd',S2:'#dce8fb',FULL:'#ffe3b9',LIBUR:'#f8dddd'};
  ['Shift 1 · 08:00–17:00','Shift 2 · 15:00–23:59','Full · 08:00–23:59','Libur'].forEach((s,i)=> { rect(24+i*340,111,9,9,Object.values(fills)[i]); text(s,42+i*340,122,13); });
  ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'].forEach((s,i)=> { rect(margin+i*cw,140,cw,34,'#ecf2e9'); text(s,margin+i*cw+12,162,14,true); });
  let y=174;
  const names = new Map(data.employees.map(e=>[e.id,e.name]));
  for(let offset=0;offset<dates.length;offset+=7) {
    const week=dates.slice(offset,offset+7);
    const height=Math.max(118,...week.map(d=>48+data.rows.filter(r=>r.date===d&&d>=data.from&&d<=data.to).reduce((n,r)=>n+52+Math.max(0,Math.ceil((names.get(r.employeeId)||'').length/21)-1)*14,0)));
    week.forEach((date,index)=>{
      const x=margin+index*cw, active=date>=data.from&&date<=data.to;
      rect(x,y,cw,height,active?'#ffffff':'#f5f7f5');
      text(String(Number(date.slice(-2))),x+12,y+24,15,true,active?'#294638':'#b6c0b9');
      if(!active)return;
      const rows=data.rows.filter(r=>r.date===date).sort((a,b)=>compareWarehouseSchedules({...a,name:names.get(a.employeeId)||''},{...b,name:names.get(b.employeeId)||''}));
      let top=y+34;
      if(!rows.length)text('Belum dijadwalkan',x+12,top+21,12,false,'#89968d');
      rows.forEach(r=>{
        const lines=(names.get(r.employeeId)||'Crew').match(/.{1,21}/gu)||['Crew'];
        const h=46+(lines.length-1)*14;
        rect(x+7,top,cw-14,h,fills[r.status==='LIBUR'?'LIBUR':r.shift||'S1']||'#eff2ed');
        lines.forEach((line,i)=>text(line,x+14,top+16+i*14,12,true));
        const shift=r.status==='LIBUR'?'LIBUR':r.shift==='FULL'?'Full shift':r.shift==='S2'?'Shift 2':'Shift 1';
        const hours=r.status==='LIBUR'?'Tidak bertugas':r.startMinutes===null||r.endMinutes===null?'Jam belum diatur':timeLabel(r.startMinutes)+'–'+timeLabel(r.endMinutes)+(r.endMinutes<=r.startMinutes?' (+1)':'');
        text(shift+' · '+hours,x+14,top+h-9,10);
        top+=h+6;
      });
    });
    y+=height;
  }
  text('WIB · Shift 2 dan Full Shift selesai 23:59 · Full shift dihitung 1 hari kerja',24,y+25,12,false,'#687d6c');
  y+=45;
  data.employees.forEach(e=>{
    const r=data.rows.filter(r=>r.employeeId===e.id&&r.date>=data.from&&r.date<=data.to);
    const label=e.name+' · '+r.filter(r=>r.status==='KERJA').length+' hari kerja · '+r.filter(r=>r.status==='LIBUR').length+' libur';
    const lines=label.match(/.{1,140}/gu)||[];
    lines.forEach(line=> {text(line,24,y,12);y+=18;});
  });
  y+=20;
  return {width,height:y,svg:'<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+y+'" viewBox="0 0 '+width+' '+y+'" role="img"><title>Kalender jadwal gudang '+escape(longDate(data.from))+' – '+escape(longDate(data.to))+'</title><rect width="100%" height="100%" fill="white"/>'+parts.join('')+'</svg>'};
}
