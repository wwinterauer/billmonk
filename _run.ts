import fs from 'fs';
import { parseCsvContent, detectDelimiter, parseDate } from './_t';
let c = fs.readFileSync('/mnt/user-uploads/260808_meinElba_umsaetze_AT953454500000402263_suche_2.csv','utf8');
if (c.charCodeAt(0)===0xFEFF) c=c.slice(1);
const d = detectDelimiter(c); console.log('delim', JSON.stringify(d));
const rows = parseCsvContent(c, d);
console.log('rows', rows.length, 'cols0', rows[0].length);
console.log(rows[0].map((x,i)=>i+':'+x.slice(0,30)));
console.log('date0', parseDate(rows[0][0]));
