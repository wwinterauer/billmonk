import fs from 'fs';
import { parseCsvFile } from './_t';
const c = fs.readFileSync('/mnt/user-uploads/260808_meinElba_umsaetze_AT953454500000402263_suche_2.csv');
const f: any = new File([c], 'x.csv', {type:'text/csv'});
for (const bank of ['raiffeisen','other','erste','sparkasse','bank_austria']) {
  try { const r = await parseCsvFile(f, bank); console.log(bank, r.success, r.totalRows, r.errors.slice(0,2)); } catch(e:any){ console.log(bank,'EX',e.message);}
}
