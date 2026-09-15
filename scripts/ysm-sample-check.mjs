import fs from 'node:fs';import path from 'node:path';import {recoverYsm} from '../src/converters/ysm/index.mjs';
const [root,reportFile]=process.argv.slice(2);
if(!root||!reportFile)throw Error('Usage: node scripts/ysm-sample-check.mjs INPUT_DIRECTORY NEW_REPORT_FILE');
if(fs.existsSync(reportFile))throw Error('Report already exists');
const files=fs.readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.ysm')).map(p=>({path:path.join(root,p),size:fs.statSync(path.join(root,p)).size})).filter(f=>f.size<=32*1024*1024).sort((a,b)=>a.size-b.size);
const chosen=[...new Set(Array.from({length:12},(_,i)=>Math.floor(i*(files.length-1)/11)))].map(i=>files[i]);
const rows=[];for(const f of chosen){const start=Date.now();try{const r=await recoverYsm(fs.readFileSync(f.path));rows.push({...f,ok:true,ms:Date.now()-start,models:r.report.models,issues:r.report.issues.length});}catch(e){rows.push({...f,ok:false,ms:Date.now()-start,error:e.message});}console.log(JSON.stringify(rows.at(-1)));}
fs.mkdirSync(path.dirname(path.resolve(reportFile)),{recursive:true});fs.writeFileSync(reportFile,JSON.stringify(rows,null,2),{flag:'wx'});
