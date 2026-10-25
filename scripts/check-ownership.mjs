import {spawnSync} from 'node:child_process';
const role=(process.argv[2]??'').toUpperCase(),base=process.argv[3]??'origin/main';
if(!['A','B','C','GROUP'].includes(role)){console.error('Usage: npm run ownership -- A|B|C|GROUP [base-ref]');process.exit(2);}
const run=(args)=>{const r=spawnSync('git',args,{encoding:'utf8'});if(r.status!==0){console.error(r.stderr);process.exit(r.status??2);}return r.stdout.split('\n').filter(Boolean);};
const files=new Set([...run(['diff','--name-only',`${base}...HEAD`]),...run(['diff','--name-only','HEAD']),...run(['ls-files','--others','--exclude-standard'])]);
const allowed={GROUP:['src/','tests/','docs/','scripts/','.github/','AGENTS.md','README.md','package.json','package-lock.json','tsconfig.json','vite.config.ts'],A:['src/tracking/','tests/tracking/','docs/PERSON_A.md','docs/status/A.md','scripts/setup-assets.mjs','package.json','package-lock.json','vite.config.ts','tsconfig.json','.github/workflows/ci.yml','THIRD_PARTY_NOTICES.md'],B:['src/analysis/','tests/analysis/','docs/PERSON_B.md','docs/status/B.md'],C:['src/ui/','tests/ui/','public/demos/','public/audio/','docs/PERSON_C.md','docs/status/C.md']}[role];
const bad=[...files].filter(p=>!allowed.some(a=>a.endsWith('/')?p.startsWith(a):p===a));
if(bad.length){console.error('Out-of-scope files: document team approval before integration.\n'+bad.join('\n'));process.exit(1);}
console.log(`Ownership check passed for ${role}: ${files.size} changed files.`);
