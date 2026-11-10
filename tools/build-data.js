const fs=require('fs');
const d=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const out={
  source:"https://gilbertmtanofficial-gif.github.io/Computing_topics_for_Grade8/",
  extractedAt:new Date().toISOString().slice(0,10),
  objectives:d.objectives,
  units:d.units.map(u=>({id:u.id,semester:u.semester,num:u.num,title:u.title,blurb:u.blurb,
    topics:u.topics.map(t=>({id:t.id,title:t.title,pages:t.pages,objectives:t.objectives,summary:t.summary,project:t.project||undefined}))})),
  plan:{semesters:d.config.semesters,weeklyPlan:d.config.weeklyPlan},
  bank:{}
};
let n=0;
for(const k in d.bank){out.bank[k]=d.bank[k].map((r,i)=>{n++;const [q,a,w,x]=r;const o={id:k+"#"+i,q,a:String(a),w:(w||[]).map(String)};if(x){if(x.c)o.c=x.c;if(x.e)o.e=x.e;if(x.t)o.t=x.t;}return o;});}
fs.writeFileSync(process.argv[3],"/* Ngân hàng câu hỏi ICT 8 — trích xuất tự động từ "+out.source+" ("+out.extractedAt+").\n   "+n+" câu hỏi tĩnh, "+Object.keys(out.bank).length+" mục tiêu học tập. Chạy lại tools/build-data.js để cập nhật. */\nwindow.QB = "+JSON.stringify(out)+";\n");
console.log('wrote',n);
