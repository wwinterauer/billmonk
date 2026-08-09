import fs from 'fs';
import { parseCsvContent, detectDelimiter, parseDate, parseCsvFile } from './_t';
let c = fs.readFileSync('/mnt/user-uploads/260808_meinElba_umsaetze_AT953454500000402263_suche_2.csv','utf8');
const file = new File([c], 'x.csv', {type:'text/csv'});
// @ts-ignore
parseCsvFile ? console.log('has parseCsvFile') : null;
