import fs from 'fs';
(globalThis as any).FileReader = class {
  onload:any; onerror:any; result:any;
  readAsText(file:any, enc:string){ file.arrayBuffer().then((b:ArrayBuffer)=>{ this.result = new TextDecoder(enc).decode(b); this.onload?.({target:this}); }); }
};
const { parseCsvFile } = await import('./_t');
const c = fs.readFileSync('/mnt/user-uploads/260808_meinElba_umsaetze_AT953454500000402263_suche_2.csv');
const f: any = new File([c], 'x.csv', {type:'text/csv'});
for (const bank of ['raiffeisen','other','erste','sparkasse','bank_austria']) {
  const r = await parseCsvFile(f, bank); console.log(bank, r.success, r.totalRows, r.errors.slice(0,2));
}
