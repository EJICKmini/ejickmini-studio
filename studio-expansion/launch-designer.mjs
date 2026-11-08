console.error("do not run: superseded, see RUN_REPORT.md");
process.exit(1);
import '../load-env.js';
import fs from 'node:fs';
const root='/workspace/naive-hackathon/studio-expansion/';
const call=async(path,data)=>{const r=await fetch('https://api.vetta.sh'+path,{method:'POST',headers:{Authorization:`Bearer ${process.env.NAIVE_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(data)});let d=await r.json();if(!r.ok){console.log(JSON.stringify(d));throw Error('Naive API '+r.status)}return d};
const system=fs.readFileSync(root+'designer-system.txt','utf8');
const agent=await call('/v1/agents',{name:'website-studio-designer',model:'z-ai/glm-5.3-flash',system,budget:{cap_micro_usd:1000000,max_task_micro_usd:1000000,period:'day'},handoffs:false,tools:{default_config:{permission:'allow'},configs:{'email.send':{enabled:false,permission:'deny'},'social.post':{enabled:false,permission:'deny'}}},mcp_servers:[]});
fs.writeFileSync(root+'designer-agent.json',JSON.stringify({id:agent.id,name:agent.name},null,2));
const message=`Implement this scoped task now. New user instruction: the current sites look AI-generated; study successful real businesses and replace that look with researched, distinctive category-specific design. You are the sole deployer. No CEO loop.
Existing URLs: /studio/ index, /studio/don-dar/, /studio/azimut/, /studio/sciencely/. Restyle those in place and ADD /studio/fine-cup/ plus /studio/promo/ with individual /studio/promo/don-dar/, /studio/promo/azimut/, /studio/promo/sciencely/. Link all from studio index and discreet Draft promo links from client pages. Do NOT change personal homepage or unrelated assets. Download/retrieve existing files first. If you cannot safely preserve the app, stop and explain.
Coffee facts below; all cafe items/prices/counts are DEMO DATA. Build a beautiful coffee menu + inventory view with low-stock/out-soon/sold-out badges driven from the included real SQL snapshot. Clearly label snapshot (not live read), synced from Neon at Nov 7 2026 1:06 PM PST. Source DB remains Neon but don't try to access DB/secrets; executor already owns DB. Derive indicators correctly, no invented predictive run-out times. Show sample hours with explicit not-verified label and local-only demo inquiry/order builder that sends nothing and persists no personal information. Provide a route or downloadable JSON snapshot for judge inspection without credentials.
${fs.readFileSync(root+'research.md','utf8')}

INVENTORY SNAPSHOT FROM NEON (parse rows as needed):
${fs.readFileSync(root+'inventory-snapshot.json','utf8')}

PROMO COPY: use all 9 captions and 3 shot-list/voiceover scripts below verbatim or lightly proofread; preserve source/approval notes. Do not generate actual videos or send anything.
${fs.readFileSync(root+'promo-copy.md','utf8')}

You have a limited budget; fetch 3 useful references per category, save specific lessons, then build and verify rather than endlessly research. Return: deployment ID, all live URLs/status, homepage unchanged verification, exact reference URLs by category, sources directory/export method. Also make /studio/expansion-source.zip (no secrets) including HTML/CSS/JS, inventory JSON, captions/scripts and references so the executor can persist the sources locally. No secrets or private agent logs in archive. One deploy after complete; corrective deploy only if verification finds a real bug.`;
fs.writeFileSync(root+'designer-task.txt',message);
const session=await call('/v1/sessions',{agent_id:agent.id,message,budget_micro_usd:1000000,mode:'build'});
fs.writeFileSync(root+'designer-session.json',JSON.stringify(session,null,2));
console.log(JSON.stringify({agent_id:agent.id,session_id:session.id,status:session.status}));
