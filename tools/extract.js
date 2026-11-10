const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(process.argv[2],'utf8');
const want=['js/config.js','js/content-s1.js','js/content-s2.js','js/bank-programming.js','js/bank-systems.js','js/bank-data.js','js/generators.js'];
const scripts={};
const re=/<script>\/\* (js\/[\w.-]+) \*\/([\s\S]*?)<\/script>/g;let m;
while((m=re.exec(html)))scripts[m[1]]=m[2];
const win={};const ctx=vm.createContext({window:win,Math,console,Set,Array,String,Object});
for(const f of want){ if(!scripts[f]) {console.error('missing',f);continue;} vm.runInContext(scripts[f],ctx,{filename:f}); }
const out=process.argv[3];
fs.writeFileSync(out+'/generators.src.js',scripts['js/generators.js']);
const units=win.UNITS.map(u=>({id:u.id,semester:u.semester,num:u.num,title:u.title,blurb:u.blurb,topics:u.topics.map(t=>({id:t.id,title:t.title,pages:t.pages,objectives:t.objectives,summary:t.summary,project:!!t.project, keys:Object.keys(t)}))}));
fs.writeFileSync(out+'/raw.json',JSON.stringify({config:win.CONFIG,objectives:win.OBJECTIVES,units,bank:win.BANK,genCount:win.GENERATORS.length, genObjs:win.GENERATORS.map(g=>g.objs)},null,1));
let total=0;for(const k in win.BANK)total+=win.BANK[k].length;
console.log('units',units.length,'topics',units.reduce((a,u)=>a+u.topics.length,0),'objectives',Object.keys(win.OBJECTIVES).length,'bank objs',Object.keys(win.BANK).length,'bank qs',total,'gens',win.GENERATORS.length);
console.log(Object.keys(win).join(','));
