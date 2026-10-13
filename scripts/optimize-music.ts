/** Keep every soundtrack in stereo, encoding 96 kbps AAC only once from the original. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import tracks from './data/soundtrack.json';
const root=path.join(__dirname,'..');
const backup=path.join(root,'.scratch/music-sources');
fs.mkdirSync(backup,{recursive:true});
const probe=(file:string)=>JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration,bit_rate:stream=codec_name,channels,sample_rate','-of','json',file],{encoding:'utf8'}));
let before=0,after=0,count=0;
for(const track of tracks){
 const file=path.join(root,'assets/music',track.file), original=probe(file);
 const inputSize=fs.statSync(file).size;
 before+=inputSize;
 if(Number(original.format.bit_rate)<=102000){after+=inputSize;continue;}
 const source=path.join(backup,path.basename(file));
 if(!fs.existsSync(source))fs.copyFileSync(file,source);
 const target=file+'.optimized.m4a';
 try {
  execFileSync('ffmpeg',['-v','error','-y','-i',source,'-map','0:a:0','-c:a','aac','-b:a','96000','-ac','2','-ar','44100','-map_metadata','-1','-movflags','+faststart',target]);
  const result=probe(target);
  assert.equal(result.streams[0].codec_name,'aac');assert.equal(result.streams[0].channels,2);
  assert.ok(Math.abs(Number(original.format.duration)-Number(result.format.duration))<0.15,track.title);
  execFileSync('ffmpeg',['-v','error','-xerror','-i',target,'-f','null','-']);
  if(fs.statSync(target).size<inputSize){fs.renameSync(target,file);count++;}
  after+=fs.statSync(file).size;
 } finally {if(fs.existsSync(target))fs.unlinkSync(target);}
}
console.log(JSON.stringify({tracks:tracks.length,reencoded:count,beforeBytes:before,afterBytes:after,savedBytes:before-after},null,2));
