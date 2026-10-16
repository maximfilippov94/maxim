// Disposable player double: exercise real cue cleanup and mute configuration.
const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
require.extensions['.wav']=(m,f)=>m.exports=f;
let events=[],finish,fail=false,hold=false,checks=0;const check=(yes,msg)=>{checks++;assert.ok(yes,msg)};
const original=Module._load;
Module._load=function(n,...rest){if(n==='expo-audio')return {setAudioModeAsync:async mode=>{events.push(['mode',mode]);},createAudioPlayer:source=>{if(fail)throw Error('unavailable');events.push(['source',source]);return {volume:0,addListener:(_,cb)=>{finish=cb;return {remove:()=>events.push(['unsubscribe'])}},play(){events.push(['play']);if(!hold)queueMicrotask(()=>finish({didJustFinish:true}))},remove(){events.push(['remove'])}}}};return original.call(this,n,...rest)};
const cues=require('../src/foodVoice/cues.ts');
(async()=>{
 for(const name of ['start','ready']){
  const bytes=fs.readFileSync(require.resolve('../assets/sounds/voice-'+name+'.wav'));
  check(bytes.toString('ascii',0,4)==='RIFF'&&bytes.readUInt16LE(22)===1,'local mono WAV '+name);
  check(bytes.readUInt32LE(40)/(bytes.readUInt32LE(24)*2)<.2,'cue shorter than 200 ms '+name);
  events=[];await cues.playVoiceCue(name);
  check(events[0][0]==='mode'&&events[0][1].playsInSilentMode===false&&events[0][1].allowsRecording===false,'cue respects silent mode before recording '+name);
  check(events.some(x=>x[0]==='play')&&events.at(-1)[0]==='remove','playback finished and player released before recording may start '+name);
 }
 hold=true;events=[];const playing=cues.playVoiceCue('start');await new Promise(r=>setTimeout(r,10));cues.cancelVoiceCue();await playing;
 check(events.filter(x=>x[0]==='remove').length===1,'cancel stops and releases cue exactly once');
 fail=true;await cues.playVoiceCue('ready');check(true,'audio playback failure does not reject voice flow');
 console.log(`PASS voice cues: ${checks} checks (local WAVs and native player double; physical audio not tested)`);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{Module._load=original});
