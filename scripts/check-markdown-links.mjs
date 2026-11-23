import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve,extname} from 'node:path';

const listed=execFileSync('git',['ls-files','-z','--','*.md'],{encoding:'utf8'}).split('\0');
const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','-z','--','*.md'],{encoding:'utf8'}).split('\0');
const files=[...new Set([...listed,...untracked].filter(Boolean))].sort();
const failures=[];

function headings(markdown){
 const ids=new Set(),counts=new Map();let fence=null,previous='';
 for(const line of markdown.split(/\r?\n/)){
  const marker=line.match(/^\s{0,3}(```+|~~~+)/)?.[1];
  if(marker){if(!fence)fence=marker[0];else if(marker[0]===fence)fence=null;previous='';continue;}
  if(fence)continue;
  for(const match of line.matchAll(/<a\s+(?:id|name)=["']([^"']+)["'][^>]*>/gi))ids.add(match[1]);
  let title=line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/)?.[1];
  if(!title&&/^\s{0,3}(?:=+|-+)\s*$/.test(line)&&previous.trim())title=previous.trim();
  if(title){
   const base=title.toLowerCase().replace(/[`*_~]/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/<[^>]*>/g,'').replace(/[^\p{L}\p{N}\s-]/gu,'').trim().replace(/\s/g,'-');
   const count=counts.get(base)??0;counts.set(base,count+1);ids.add(count?`${base}-${count}`:base);
  }
  previous=line;
 }
 return ids;
}

for(const file of files){
 const source=readFileSync(file,'utf8');let fence=null;
 const lines=source.split(/\r?\n/);
 for(let index=0;index<lines.length;index++){
  const line=lines[index],marker=line.match(/^\s{0,3}(```+|~~~+)/)?.[1];
  if(marker){if(!fence)fence=marker[0];else if(marker[0]===fence)fence=null;continue;}
  if(fence)continue;
  const inline=line.replace(/(`+)(.*?)\1/g,'');
  const pattern=/!?\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+[^)]*)?\)/g;
  for(const match of inline.matchAll(pattern)){
   let target=match[1].replace(/^<|>$/g,'').replace(/\\([() ])/g,'$1');
   if(/^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(target)||target.startsWith('//'))continue;
   const hash=target.indexOf('#'),query=target.indexOf('?');let path=target;
   if(hash>=0)path=path.slice(0,hash);if(query>=0&&query<(hash<0?Infinity:hash))path=path.slice(0,query);
   const fragment=hash>=0?decodeURIComponent(target.slice(hash+1).split('?')[0]):'';
   try{path=decodeURIComponent(path);}catch{failures.push(`${file}:${index+1}: malformed URL encoding in link`);continue;}
   const resolved=path?resolve(dirname(file),path):resolve(file);
   if(!existsSync(resolved)){failures.push(`${file}:${index+1}: missing local target ${path||'(current file)'}`);continue;}
   if(fragment&&extname(resolved).toLowerCase()==='.md'){
    let targetText;try{targetText=readFileSync(resolved,'utf8');}catch{continue;}
    if(!headings(targetText).has(fragment))failures.push(`${file}:${index+1}: missing heading #${fragment} in ${path||file}`);
   }
  }
 }
}

if(failures.length){console.error(`Found ${failures.length} broken local Markdown link(s) across ${files.length} files.`);for(const failure of failures.slice(0,100))console.error(failure);if(failures.length>100)console.error(`... ${failures.length-100} more omitted.`);process.exitCode=1;}
else console.log(`Checked local Markdown links in ${files.length} tracked and untracked Markdown files; none are broken.`);
