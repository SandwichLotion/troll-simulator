"use strict";
/* Shared by the game and the Admin page. A missing element returns a detached stand-in, so each page can include only the markup it needs. */
const $=s=>document.querySelector(s)||document.createElement("div");
const has=id=>!!document.getElementById(id);
const store={get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};

/* TikTok sign-in (Login Kit). Needs a TikTok developer app and the small sign-in server in /lib.
   Set apiBase to your deployed server's URL (for example https://troll-simulator-auth.<you>.workers.dev).
   The client key and redirect address come from the server. See the README. Leave apiBase empty to
   play without sign-in. */
const AUTH={googleClientId:"",tiktokClientKey:"",apiBase:"",tiktokScope:"user.info.basic",
  redirectUri(){return new URL("play.html",location.href).href},
  async google(){if(!this.googleClientId)return toast("Add your Google client ID in AUTH.googleClientId");
    /* load accounts.google.com/gsi/client, initialize with client_id, POST the credential to your server */},
  async tiktok(){
    let key=this.tiktokClientKey,redir=this.redirectUri();
    if(!key&&this.apiBase){try{const r=await fetch(api("/auth/config"));if(r.ok){const c=await r.json();key=c.tiktokClientKey;if(c.redirectUri)redir=c.redirectUri}}catch(e){}}
    if(!key)return toast("TikTok sign-in isn’t set up on this site yet.");
    if(location.protocol!=="https:")return toast("TikTok sign-in only works when the game is served over HTTPS.");
    const a=new Uint8Array(16);crypto.getRandomValues(a);const st=[...a].map(x=>x.toString(16).padStart(2,"0")).join("");
    try{sessionStorage.setItem("ts_oauth_state",st)}catch(e){return toast("Your browser blocked sign-in storage. Allow site data and try again.")}
    const u=new URL("https://www.tiktok.com/v2/auth/authorize/");
    u.search=new URLSearchParams({client_key:key,scope:this.tiktokScope,response_type:"code",redirect_uri:redir,state:st}).toString();
    location.assign(u.toString());
  }};
let SESSION=store.get("ts_session",null);
const api=p=>AUTH.apiBase.replace(/\/$/,"")+p;
function setSession(token,user){
  SESSION={token,user:{id:String(user.id),name:String(user.name||"TikTok user"),avatar:String(user.avatar||""),exp:Number(user.exp)||0}};
  store.set("ts_session",SESSION);
  if(P.name==="Troll Whisperer"){P.name=SESSION.user.name.slice(0,24);store.set("ts_profile",P);paint()}
  renderAcct();
}
function signOut(){SESSION=null;store.set("ts_session",null);renderAcct();toast("Signed out")}
function renderAcct(){
  const on=!!SESSION,u=on?SESSION.user:null;
  $("#acctIn").hidden=!on;$("#acctOut").hidden=on;
  {const l=$("#acctBtn span");if(l)l.textContent=on?u.name:"Account"}
  if(on){
    $("#acctNm").textContent=u.name;const av=$("#acctAv");av.textContent="";
    if(/^https:\/\//.test(u.avatar)){const i=document.createElement("img");i.src=u.avatar;i.alt="";i.referrerPolicy="no-referrer";i.onerror=()=>{av.textContent="🧌"};av.appendChild(i)}else av.textContent="🧌";
  }
}
async function handleAuthReturn(){
  const q=new URLSearchParams(location.search);
  if(!q.has("code")&&!q.has("error"))return;
  const code=q.get("code"),state=q.get("state"),err=q.get("error");
  history.replaceState(null,"",location.pathname+location.hash);
  let saved=null;try{saved=sessionStorage.getItem("ts_oauth_state");sessionStorage.removeItem("ts_oauth_state")}catch(e){}
  if(err){toast("TikTok sign-in was cancelled or isn’t available for this account.");return}
  if(!code||!state||!saved||state!==saved){toast("TikTok sign-in couldn’t be verified. Please try again.");return}
  if(!AUTH.apiBase){toast("TikTok sign-in isn’t set up on this site.");return}
  try{
    const r=await fetch(api("/auth/tiktok"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,redirect_uri:AUTH.redirectUri()})});
    const j=await r.json();if(!r.ok||!j.session||!j.user)throw new Error("auth");
    setSession(j.session,j.user);toast("Signed in as "+j.user.name);
  }catch(e){toast("TikTok sign-in failed. Please try again.")}
}
async function checkSession(){
  if(!SESSION||!AUTH.apiBase)return;
  try{
    const r=await fetch(api("/me"),{headers:{Authorization:"Bearer "+SESSION.token}});
    if(r.status===401){SESSION=null;store.set("ts_session",null);renderAcct();toast("Your TikTok sign-in expired. Sign in again.")}
  }catch(e){/* offline: keep the saved sign-in */}
}

const A=["xX","real","not","itz","big","lil","mr","its"],B=["hater","gamer","dave","pixel","karen","vibes","ghost","toad","fr","noodle"];
const NICE=["hi everyone! 👋","love this live","great vibes ✨","hello from Texas","can you say hi?","this is fun","first time here!","nice setup"];
const EAGER=["OMG best live EVER!!!","literally obsessed w/ u","u deserve 1M followers!!","greatest creator on here!!","follow4follow?? pls!!"];
const CURSE=["#@$%&!","&*%$# you!!","@#$! off","$#!@ loser","%&*@!! 🤬","#$@% this live"];
const AMB=["lol","❤️❤️","what’s the topic?","sound is good","hi from Brazil","gm","how long u been live?","hey hey"];
const EMO=["🙂","😄","🧑‍🎤","🐱","🎧","🌻","🦁","🧢","👩‍🚀","🍕"];
const BOXN=[3,6,6,9],LEN=50;
const rnd=(a,b)=>a+Math.random()*(b-a),ri=(a,b)=>Math.floor(rnd(a,b+1));
let uid=0;
const BASE={nice:NICE,eager:EAGER,curse:CURSE,chat:AMB};
let EXTRA={nice:[],eager:[],curse:[],chat:[]};
const DIFF={easy:{join:1.35,sleep:1.4,drain:.7,bad:.75},medium:{join:1,sleep:1,drain:1,bad:1},hard:{join:.75,sleep:.7,drain:1.3,bad:1.25}};
let CFG=Object.assign({diff:"medium",sound:true,vol:.8,sfx:true,unmute:true,base:"sounds/",csv:"",nameMix:.7,maxKB:1024,maxSec:10,cfgTxt:"",relaxed:false},store.get("ts_cfg",{}));
const D=()=>DIFF[CFG.diff]||DIFF.medium;
const SB={map:{},files:{},meta:{},rows:[],live:new Set(),n:0,a:0};
/* Uploaded mp3 files are kept in IndexedDB so the Admin page and the game share them. */
const IDB={
  db:null,
  open(){return this.db||(this.db=new Promise(res=>{try{const r=indexedDB.open("troll-sim",1);r.onupgradeneeded=()=>r.result.createObjectStore("clips",{keyPath:"k"});r.onsuccess=()=>res(r.result);r.onerror=()=>res(null)}catch(e){res(null)}}))},
  async run(mode,fn){const d=await this.open();if(!d)return null;return new Promise(res=>{try{const t=d.transaction("clips",mode),out=fn(t.objectStore("clips"));t.oncomplete=()=>res(out&&"result" in out?out.result:true);t.onerror=t.onabort=()=>res(null)}catch(e){res(null)}})},
  put(k,blob,meta){return this.run("readwrite",s=>s.put({k,blob,meta}))},
  all(){return this.run("readonly",s=>s.getAll()).then(r=>r||[])},
  clear(){return this.run("readwrite",s=>s.clear())}
};
let SCORES=store.get("ts_scores",null),NAMES=store.get("ts_names",[]),SHEET=[];
const EMOJI=["😎","🦊","🐸","👾","🌸","🔥","🐼","👑"];
const BGS=["linear-gradient(135deg,#fe2c55,#25f4ee)","linear-gradient(135deg,#7b2ff7,#f107a3)","linear-gradient(135deg,#f7971e,#ffd200)","linear-gradient(135deg,#11998e,#38ef7d)","linear-gradient(135deg,#232526,#414345)","linear-gradient(135deg,#2193b0,#6dd5ed)"];
const LAYOUTS={grid:["▦","grid"],duo:["◫","large"],list:["☰","list"]};
const pick=a=>a[Math.floor(Math.random()*a.length)];
const fmt=n=>n>=1000?(n/1000).toFixed(1)+"K":String(Math.round(n));

let P=store.get("ts_profile",{name:"Troll Whisperer",handle:"troll.whisperer",emoji:"😎",bg:0,photo:null});
let best=0,layout=store.get("ts_layout","grid"),tool="block",g=null,openU=null;

let ac=null;
function beep(f,d=.08,type="sine"){if(!CFG.sfx)return;try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator(),v=ac.createGain();o.type=type;o.frequency.value=f;v.gain.value=.05;o.connect(v);v.connect(ac.destination);o.start();o.stop(ac.currentTime+d)}catch(e){}}
function toast(m,ms){const t=document.createElement("div");t.className="toast";t.setAttribute("role","alert");t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),ms||2600)}

function paint(){
  const bg=P.photo?`url(${P.photo}) center/cover`:BGS[P.bg];
  $("#cover").style.background=bg;$("#hostAv").style.background=bg;
  $("#hostAv").textContent=P.photo?"":P.emoji;$("#hostName").textContent=P.name;
}
/* ---------- LIVE flow: you are the creator ---------- */
function goLive(){
  $("#start").hidden=true;$("#end").hidden=true;
  const cd=$("#cd");cd.hidden=false;let n=3;cd.textContent=n;beep(600,.1);
  const iv=setInterval(()=>{n--;if(n<=0){clearInterval(iv);cd.hidden=true;begin()}else{cd.textContent=n;beep(600,.1)}},800);
}
function begin(){
  g={score:0,t:0,level:1,shown:0,open:3,hp:100,view:60,peak:60,run:true,paused:false,boxes:Array(9).fill(null),queue:[],groups:[],invites:[],nJoin:3,nChat:2,dirty:false,c:{early:0,raids:0,wrong:0,stopped:0}};
  $("#feed").textContent="";
  cl("","Welcome to your LIVE! Guests will take the boxes. Tap a box to check who they are, or tap 🎙️ to mute.","sys");
  setHold(false);syncDiff();step();g.tick=setInterval(step,500);
}
function cl(name,text,cls){const f=$("#feed"),d=document.createElement("div");d.className="cl "+(cls||"");if(!cls)d.setAttribute("aria-hidden","true");
  if(name){if(isFollower(name)){const i=document.createElement("i");i.className="fbadge";i.textContent=FOLLOW_BADGE;d.appendChild(i)}const b=document.createElement("b");b.textContent=name;d.appendChild(b)}
  d.appendChild(document.createTextNode(text));f.appendChild(d);while(f.children.length>7)f.firstChild.remove()}
const sys=t=>cl("",t,"sys");
function mkUser(bad,grp){
  const u={id:++uid,bad,grp:grp||null,name:genName(bad),emoji:pick(EMO),bg:ri(0,5),box:null,mic:true,muted:false,neutral:false,yelling:false,sharer:false,via:null,say:"",sayAt:0,sayClr:0,nextGift:g.t+rnd(6,12),nextCurse:0,gone:false,pendingInv:null};
  if(bad){u.age=Math.random()<.8?ri(0,6):ri(30,200);u.fol=Math.random()<.7?ri(0,80):ri(200,2000);u.rep=Math.random()<.6?ri(1,4):0;u.sleepUntil=g.t+(Math.max(10,34-(g.level-1)*6)+rnd(0,8))*D().sleep}
  else{u.age=Math.random()<.75?ri(20,1200):ri(0,6);u.fol=ri(40,20000);u.rep=Math.random()<.1?1:0;u.leaveAt=0}
  return u;
}
function mkGroup(n){const grp={dead:false,fired:false,go:0,members:[]};for(let i=0;i<n;i++)grp.members.push(mkUser(true,grp));g.groups.push(grp);return grp}
function join(u){
  if(!u.bad)u.leaveAt=g.t+rnd(25,55);
  sys(u.name+" joined"+(u.via?" via "+u.via+"’s link":""));seat(u);
}
function seat(u){
  const i=g.boxes.slice(0,g.open).findIndex(b=>!b);
  if(i<0){g.queue.push(u);return}
  g.boxes[i]=u;u.box=i;u.sayAt=g.t+rnd(2,6);
  if(u.pendingInv){scheduleInvites(u,u.pendingInv);u.pendingInv=null}
  g.dirty=true;
}
function fillQ(){while(g.queue.length&&g.boxes.slice(0,g.open).some(b=>!b))seat(g.queue.shift())}
function eject(u){u.gone=true;stopVoice(u);if(u.box!=null){g.boxes[u.box]=null;u.box=null}if(u.grp&&!u.grp.fired)u.grp.dead=true;fillQ();g.dirty=true}
function scheduleInvites(s,members){
  s.sharer=true;sys("🔗 "+s.name+" shared this LIVE with friends");
  members.forEach((m,i)=>{m.via=s.name;g.invites.push({at:g.t+6+i*3,u:m,s})});g.dirty=true;
}
function cancelInvites(s){
  const mine=g.invites.filter(i=>i.s===s);g.invites=g.invites.filter(i=>i.s!==s);let bad=false;
  mine.forEach(i=>{if(i.u.bad){bad=true;if(i.u.grp)i.u.grp.dead=true}});return bad;
}
function startRaid(){
  const L=g.level,size=L>=3?3:2,r=Math.random();
  const good=g.boxes.slice(0,g.open).filter(u=>u&&!u.bad&&!u.sharer);
  if(r<.25&&good.length){const fr=[mkUser(false)];if(L>=3)fr.push(mkUser(false));return scheduleInvites(pick(good),fr)}   /* good friends */
  if(L>=3&&r<.55&&good.length){return scheduleInvites(pick(good),mkGroup(2).members)}                                  /* trojan: bad guests use a good user's link */
  const grp=mkGroup(size),s=grp.members[0];s.pendingInv=grp.members.slice(1);join(s);                                  /* bad sharer brings the raid */
}
function newJoin(){
  const L=g.level,live=g.groups.filter(x=>!x.dead&&!x.fired).length;
  if(L>=2&&live<(L>=4?2:1)&&Math.random()<.3)return startRaid();
  join(mkUser(Math.random()<[.2,.25,.3,.35][Math.min(L-1,3)]*D().bad));
}
function startYell(u){if(u.neutral||u.gone||u.yelling)return;u.yelling=true;u.nextCurse=g.t+2.5;u.say=pick(lines("curse"));cl(u.name,u.say,"bad");voice(u,u.say);g.dirty=true}
function ambient(){
  const r=Math.random(),seated=g.boxes.slice(0,g.open).filter(u=>u&&!u.yelling&&!u.muted),nm=genName(false);
  if(r<.2)cl("",nm+" joined","sys");
  else if(r<.65||!seated.length)cl(nm,pick(lines("chat")));
  else{const u=pick(seated),tx=u.bad&&!u.neutral?pick(lines("eager")):pick(lines("nice"));cl(u.name,tx);voice(u,tx)}
}
function gift(u){const b=$("#banner");b.textContent=u.emoji+" "+u.name+" sent a Rose 🌹";b.classList.add("show");setTimeout(()=>b.classList.remove("show"),2000)}

function step(){
  if(!g||!g.run||g.paused||g.hold)return;
  g.t+=.5;const L=g.level=1+Math.floor(g.t/LEN);
  if(L!==g.shown){g.shown=L;$("#lvl").textContent="Level "+L;g.open=BOXN[Math.min(L-1,3)];
    if(L>1)sys("⭐ Level "+L+(L===2?": raids begin. Watch who shares the link 🔗":L===3?": bigger raids and trojan links":": full chaos"));fillQ();g.dirty=true}
  if(g.t>=g.nJoin){newJoin();g.nJoin=g.t+Math.max(2.5,9-(L-1)*2.2)*rnd(.7,1.3)*D().join*(CFG.relaxed?1.5:1)}
  if(g.t>=g.nChat){ambient();g.nChat=g.t+Math.max(1.2,5-(L-1))*rnd(.7,1.3)}
  const due=g.invites.filter(i=>g.t>=i.at);g.invites=g.invites.filter(i=>g.t<i.at);due.forEach(i=>join(i.u));
  let yellers=0,goods=0;
  for(const u of g.boxes.slice(0,g.open)){
    if(!u)continue;
    if(u.muted&&CFG.unmute&&g.t>=u.unmuteAt){u.muted=false;u.mic=true;u.neutral=false;u.sayAt=g.t+rnd(2,5);sys(u.name+" turned their mic back on 🎙️");g.dirty=true;if(u.bad&&(!u.grp||u.grp.fired||u.grp.dead))startYell(u)}
    if(!u.bad){goods++;
      if(!CFG.relaxed&&g.t>=u.leaveAt){sys(u.name+" left");eject(u);continue}
      if(g.t>=u.nextGift){u.nextGift=g.t+rnd(7,12);g.score+=2;gift(u)}
    }else if(!u.neutral&&!u.yelling&&!u.grp&&g.t>=u.sleepUntil)startYell(u);
    if(u.yelling){yellers++;if(g.t>=u.nextCurse){u.nextCurse=g.t+2.5;u.say=pick(lines("curse"));cl(u.name,u.say,"bad");voice(u,u.say);g.dirty=true}}
    else if(!u.muted){
      if(!u.say&&g.t>=u.sayAt){u.say=u.bad?pick(lines("eager")):pick(lines("nice"));voice(u,u.say);u.sayAt=g.t+rnd(9,16);u.sayClr=g.t+3.5;g.dirty=true}
      else if(u.say&&g.t>=u.sayClr){u.say="";g.dirty=true}
    }
  }
  for(const grp of g.groups){
    if(grp.dead||grp.fired)continue;
    if(!grp.go&&grp.members.every(m=>m.box!=null))grp.go=g.t+3;       /* they wait until everyone is in a box */
    if(grp.go&&g.t>=grp.go){grp.fired=true;grp.members.forEach(m=>startYell(m))}
  }
  g.hp=yellers?g.hp-yellers*1.5*D().drain*(CFG.relaxed?.6:1):Math.min(100,g.hp+.25);
  g.view=Math.max(10,g.view+(60+g.score*1.2+goods*35-yellers*60-g.view)*.15);g.peak=Math.max(g.peak,g.view);
  if(g.hp<=0)return endLive("TikTok ended your LIVE for guideline violations");
  if(g.dirty){render();g.dirty=false}hud();
}
function render(){
  const el=$("#boxes"),ae=document.activeElement,key=ae&&el.contains(ae)&&ae.dataset.act?ae.dataset.act+":"+ae.dataset.u:null;
  el.textContent="";
  for(let i=0;i<g.open;i++){
    const u=g.boxes[i],d=document.createElement("div");
    if(!u){d.className="box empty";d.innerHTML='<span aria-hidden="true">⏳</span>Waiting for guests';el.appendChild(d);continue}
    d.className="box"+(u.yelling?" yell":"")+(u.muted?" muted":"");d.style.background=BGS[u.bg];
    const st=(isFollower(u.name)?FOLLOW_BADGE+". ":"")+(u.yelling?"Yelling. ":u.muted?"Mic muted. ":"Mic on. ")+(u.sharer?"Shared the LIVE link. ":"")+(u.via?"Joined via "+u.via+". ":"");
    const open=document.createElement("button");open.className="open";open.dataset.act="open";open.dataset.u=u.id;open.setAttribute("aria-label","Open profile for "+u.name+". "+st);
    d.innerHTML='<span class="em" aria-hidden="true">'+u.emoji+'</span>'+(u.sharer?'<i class="shr" aria-hidden="true">🔗</i>':'')+'<b class="nm" aria-hidden="true">'+esc(u.name)+'</b>'+(isFollower(u.name)?'<i class="fbadge boxb" aria-hidden="true">'+FOLLOW_BADGE+'</i>':'')+(u.via?'<em class="via" aria-hidden="true">via '+esc(u.via)+'</em>':'')+'<div class="say" aria-hidden="true">'+(u.yelling?"🤬 ":"")+esc(u.say)+'</div>';
    const mic=document.createElement("button");mic.className="mic";mic.dataset.act="mute";mic.dataset.u=u.id;mic.textContent=u.mic?"🎙️":"🔇";
    mic.setAttribute("aria-label","Mute microphone for "+u.name);mic.setAttribute("aria-pressed",String(!!u.muted));
    d.append(open,mic);el.appendChild(d);
  }
  if(key){const [a,id]=key.split(":"),n=el.querySelector('[data-act="'+a+'"][data-u="'+id+'"]');if(n)n.focus({preventScroll:true})}
}
function hud(){
  const h=g?Math.max(0,g.hp):100,b=$("#hp");
  $("#score").textContent=g?g.score:0;$("#viewers").textContent=g?fmt(g.view):"0";
  b.style.width=h+"%";b.style.background=h>60?"var(--cyan)":h>30?"#ffd200":"var(--pink)";const hb=$("#hpbar");$("#hpv").textContent=Math.round(h)+"%";hb.setAttribute("aria-valuenow",String(Math.round(h)));hb.setAttribute("aria-valuetext","Community health "+Math.round(h)+" percent");hb.classList.toggle("low",h<30);
  $("#wait").textContent="⏳ "+(g?g.queue.length:0)+" waiting";
}
function fx(x,y,t){const d=document.createElement("div");d.className="fx";d.textContent=t;d.style.left=(x-20)+"px";d.style.top=(y-20)+"px";document.body.appendChild(d);setTimeout(()=>d.remove(),900)}
function fxAt(u,t){const e=document.querySelector('[data-u="'+u.id+'"]'),r=e?e.getBoundingClientRect():{left:innerWidth/2,top:220,width:0,height:0};fx(r.left+r.width/2,r.top+r.height/2,t)}
function heart(x,y){const d=document.createElement("div");d.className="heart";d.textContent=pick(["❤️","💖","💗","🩷"]);d.style.left=x+"px";d.style.top=y+"px";document.body.appendChild(d);setTimeout(()=>d.remove(),1200)}

/* ---------- Moderation ---------- */
function act(u,k){
  if(!g||!g.run||u.gone)return;
  let pts=0;const was=u.yelling;
  if(k==="mute"){
    if(u.muted)return;u.muted=true;u.mic=false;u.neutral=true;u.yelling=false;u.say="";u.mutes=(u.mutes||0)+1;stopVoice(u);u.unmuteAt=g.t+Math.max(4,rnd(8,16)-(g.level-1)*2);
    if(u.bad){pts=u.mutes>1?4:10;if(was)g.c.stopped++;else if(u.mutes===1)g.c.early++}else{pts=-3;g.hp-=2;g.c.wrong++}
  }else if(k==="thank"){
    if(!u.bad){pts=4;u.leaveAt+=15;const e=document.querySelector('[data-u="'+u.id+'"]');if(e){const r=e.getBoundingClientRect();heart(r.left+20,r.top+20)}}else pts=-3;
  }else{
    const blocked=k==="block";eject(u);const pre=blocked?cancelInvites(u):false;
    if(u.bad){pts=(blocked?20:15)+(was?0:10);was?g.c.stopped++:g.c.early++}
    else{pts=blocked?-30:-15;g.hp-=8;g.c.wrong++}
    if(pre){pts+=30;g.c.raids++;sys("🛡️ Raid prevented! Their invites were cancelled.")}
  }
  g.score=Math.max(0,g.score+pts);fxAt(u,(pts>=0?"+":"")+pts);beep(pts>=0?600:150,.1,pts>=0?"triangle":"square");render();hud();
}
function openUser(u){
  if(!g||!g.run||u.gone)return;g.paused=true;
  $("#uAv").textContent=u.emoji;$("#uAv").style.background=BGS[u.bg];$("#uName").innerHTML=followBadge(u.name)+esc(u.name);
  $("#uSub").textContent=(u.yelling?"🤬 Yelling right now":u.muted?"🔇 Mic muted":"🎙️ Mic on")+(isFollower(u.name)?" · Follows "+FOLLOW_ACCOUNT:"");
  const bio=bioFor(u.name),ub=$("#uBio");ub.textContent=bio;ub.hidden=!bio;
  $("#uDos").innerHTML='<div><b>'+u.age+' days</b>Account age</div><div><b>'+fmt(u.fol)+'</b>Followers</div><div><b>'+u.rep+'</b>Reports</div><div><b>'+(u.via?esc(u.via):"For You feed")+'</b>Joined via</div><div style="grid-column:1/-1"><b>'+(u.sharer?"Yes 🔗":"No")+'</b>Shared the LIVE link</div>';
  const a=$("#uActs");a.textContent="";
  [["mute","🎙️","Mute mic"],["remove","✂️","Remove"],["block","🚫","Block"],["thank","🎁","Thank"]].forEach(([k,i,n])=>{
    const b=document.createElement("button");b.innerHTML="<span>"+i+"</span>"+n;b.onclick=()=>{closeUser();act(u,k)};a.appendChild(b)});
  $("#userSheet").hidden=false;
}
function closeUser(){$("#userSheet").hidden=true;if(g)g.paused=false}
function endLive(reason){
  g.run=false;clearInterval(g.tick);stopAll();$("#userSheet").hidden=true;
  const isBest=g.score>best;addScore(g.score,g.level);
  $("#endMsg").textContent=reason+(isBest?" · New high score!":"");$("#endScore").textContent=g.score;
  const s=[["Level reached",g.level],["Peak viewers",fmt(g.peak)],["Caught early",g.c.early],["Raids prevented",g.c.raids],["Stopped mid-yell",g.c.stopped],["Good guests wronged",g.c.wrong]];
  $("#stats").innerHTML=s.map(([k,v])=>"<div><b>"+v+"</b>"+k+"</div>").join("")+'<div style="grid-column:1/-1"><b>'+best+'</b>High score ('+CFG.diff+')</div>';
  $("#end").hidden=false;syncDiff();hud();beep(isBest?880:300,.3,"triangle");
}

/* ---------- Share ---------- */
const shareText=()=>`I earned ${g?g.score:best} 💎 on The Troll Simulator LIVE 🧌 Can you beat my ${CFG.diff} high score of ${best}? #TrollSimulator`;
async function shareScore(){
  const text=shareText(),url=location.href;
  try{if(navigator.share){await navigator.share({title:"The Troll Simulator",text,url});return}}catch(e){if(e&&e.name==="AbortError")return}
  try{await navigator.clipboard.writeText(text+" "+url);toast("Copied. Paste it into TikTok.")}catch(e){toast("Save the score card and post it on TikTok.")}
}
function cardBlob(){return new Promise(res=>{
  const c=document.createElement("canvas");c.width=1080;c.height=1920;const x=c.getContext("2d"),gr=x.createLinearGradient(0,0,1080,1920);
  gr.addColorStop(0,"#fe2c55");gr.addColorStop(1,"#25f4ee");x.fillStyle="#050507";x.fillRect(0,0,1080,1920);x.globalAlpha=.35;x.fillStyle=gr;x.fillRect(0,0,1080,1920);x.globalAlpha=1;
  x.textAlign="center";x.fillStyle="#fff";x.font="800 84px sans-serif";x.fillText("The Troll Simulator",540,420);
  x.font="800 340px sans-serif";x.fillText(String(g?g.score:best),540,1000);x.font="600 56px sans-serif";x.fillText("@"+P.handle,540,1160);x.fillText("High score ("+CFG.diff+") "+best,540,1250);
  x.font="500 46px sans-serif";x.fillText("Can you beat me?",540,1500);c.toBlob(res,"image/png")})}
async function saveCard(){const b=await cardBlob();await saveBlob(b,"troll-simulator-score.png")}
async function openAcct(){
  $("#acctSheet").hidden=false;renderAcct();
  try{const u=await claude.use("user");if(u){const me=await u.me();if(me&&me.name)$("#acctMsg").textContent="Viewing as "+me.name+" via Claude. Your high score is saved on this device."}}catch(e){}
}

/* ---------- Profile editor ---------- */
function swatches(){
  const e=$("#emojiSw");e.textContent="";EMOJI.forEach(m=>{const b=document.createElement("button");b.textContent=m;b.className=!P.photo&&P.emoji===m?"on":"";b.onclick=()=>{P.emoji=m;P.photo=null;swatches();paint()};e.appendChild(b)});
  const s=$("#bgSw");s.textContent="";BGS.forEach((bg,i)=>{const b=document.createElement("button");b.style.background=bg;b.setAttribute("aria-label","Background "+(i+1));b.className=!P.photo&&P.bg===i?"on":"";b.onclick=()=>{P.bg=i;P.photo=null;swatches();paint()};s.appendChild(b)});
}
$("#photoIn").onchange=e=>{const f=e.target.files[0];if(!f)return;const img=new Image(),r=new FileReader();
  r.onload=()=>{img.onload=()=>{const c=document.createElement("canvas");c.width=c.height=360;const x=c.getContext("2d"),s=Math.min(img.width,img.height);x.drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,360,360);P.photo=c.toDataURL("image/jpeg",.8);swatches();paint()};img.src=r.result};r.readAsDataURL(f)};

/* ---------- Settings + soundbytes (difficulty,Text They Say,mp3file) ---------- */
const saveCfg=()=>store.set("ts_cfg",CFG);
const norm=s=>String(s).toLowerCase().replace(/\s+/g," ").trim();
function lines(kind){return BASE[kind].concat(EXTRA[kind].filter(x=>x.d==="all"||x.d===CFG.diff).map(x=>x.t))}
function parseCSV(t){
  const rows=[];let r=[],c="",q=false;
  for(let i=0;i<t.length;i++){const ch=t[i];
    if(q){if(ch==='"'){if(t[i+1]==='"'){c+='"';i++}else q=false}else c+=ch}
    else if(ch==='"')q=true;
    else if(ch===","){r.push(c);c=""}
    else if(ch==="\n"||ch==="\r"){if(ch==="\r"&&t[i+1]==="\n")i++;r.push(c);c="";if(r.some(x=>x.trim()))rows.push(r);r=[]}
    else c+=ch}
  r.push(c);if(r.some(x=>x.trim()))rows.push(r);return rows;
}
function loadCSV(text){
  SB.map={};SB.rows=[];SB.n=0;SB.a=0;EXTRA={nice:[],eager:[],curse:[],chat:[]};
  parseCSV(String(text).replace(/^﻿/,"")).forEach((r,i)=>{
    if(i===0&&norm(r[0])==="difficulty")return;
    const d=norm(r[0]||"all"),t=(r[1]||"").trim(),f=(r[2]||"").trim(),k=norm(r[3]||"");
    if(!t)return;
    const dd=["easy","medium","hard"].includes(d)?d:"all";
    SB.n++;if(f)SB.a++;SB.rows.push({d:dd,t,f,k});
    (SB.map[norm(t)]=SB.map[norm(t)]||[]).push({d:dd,f});
    const known=Object.values(BASE).some(a=>a.some(x=>norm(x)===norm(t)));
    if(!known){const kind=["nice","eager","curse","chat"].includes(k)?k:"nice";
      if(!EXTRA[kind].some(x=>norm(x.t)===norm(t)&&x.d===dd))EXTRA[kind].push({t,d:dd})}
  });
  sbStatus();
}
function fileUrl(f){
  const k=f.toLowerCase();if(SB.files[k])return SB.files[k];
  if(/^(https?:)?\/\//.test(f)||f[0]==="/")return f;
  const b=CFG.base||"";return (!b||b.endsWith("/")?b:b+"/")+f;
}
function voice(u,text){
  if(!CFG.sound||SB.live.size>=3)return;
  const m=SB.map[norm(String(text).replace(/^🤬\s*/,""))];if(!m)return;
  const ok=m.filter(x=>x.f&&(x.d==="all"||x.d===CFG.diff));if(!ok.length)return;
  stopVoice(u);
  try{const a=new Audio(fileUrl(pick(ok).f));a.volume=CFG.vol;u.audio=a;SB.live.add(a);
    a.onended=a.onerror=()=>SB.live.delete(a);a.play().catch(()=>SB.live.delete(a))}catch(e){}
}
function stopVoice(u){if(u.audio){u.audio.pause();SB.live.delete(u.audio);u.audio=null}}
function stopAll(){SB.live.forEach(a=>a.pause());SB.live.clear()}
function sbStatus(){
  const up=Object.keys(SB.files).length,el=$("#sbStat");if(has("grid"))renderGrid();if(!el)return;const gb=$("#gridBtn");if(gb)gb.hidden=!SB.n;const ls=$("#limStat");if(ls)ls.textContent="Max clip size: "+CFG.maxKB+" KB and "+CFG.maxSec+" s (set in config.txt)";
  el.textContent=(SB.n?SB.n+" lines loaded · "+SB.a+" with an mp3":"No soundbytes loaded, guests talk silently")+" · "+up+" mp3 file"+(up===1?"":"s")+" uploaded";
}
async function saveBlob(blob,name){
  if(typeof claude!=="undefined"){try{const d=await claude.use("downloads");if(d){await d.save({filename:name,data:blob});return}}catch(e){if(e&&e.code==="declined")return}}
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
}
function csvTemplate(){
  const q=s=>/[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s,rows=["difficulty,Text They Say,mp3file"];
  [NICE,EAGER,CURSE].forEach(a=>a.forEach(t=>rows.push("all,"+q(t)+",")));
  return rows.join("\r\n")+"\r\n";
}
function syncCfg(){
  syncDiff();
  $("#cfgUnmute").checked=!!CFG.unmute;$("#cfgRelaxed").checked=!!CFG.relaxed;$("#cfgSound").checked=!!CFG.sound;$("#cfgSfx").checked=!!CFG.sfx;
  $("#cfgVol").value=CFG.vol;$("#cfgBase").value=CFG.base;sbStatus();
}
function openCfg(){syncCfg();openSheet("#cfgSheet")}
function closeCfg(){closeSheet("#cfgSheet")}
function initSB(){
  IDB.all().then(rows=>{rows.forEach(r=>{if(r&&r.blob&&!SB.files[r.k]){SB.files[r.k]=URL.createObjectURL(r.blob);SB.meta[r.k]=r.meta||{kb:Math.round(r.blob.size/1024),sec:0}}});sbStatus()});
  if(CFG.csv)loadCSV(CFG.csv);
  else{try{fetch("soundbytes.csv").then(r=>r.ok?r.text():Promise.reject()).then(t=>{if(norm(t.replace(/^﻿/,"")).startsWith("difficulty"))loadCSV(t)}).catch(()=>{})}catch(e){}}
  sbStatus();
}
$("#cfgBtn").onclick=openCfg;$("#cfgBtn2").onclick=openCfg;$("#cfgDone").onclick=closeCfg;
$("#cfgUnmute").onchange=e=>{CFG.unmute=e.target.checked;saveCfg()};
$("#cfgSound").onchange=e=>{CFG.sound=e.target.checked;if(!CFG.sound)stopAll();saveCfg()};
$("#cfgSfx").onchange=e=>{CFG.sfx=e.target.checked;saveCfg()};
$("#cfgVol").oninput=e=>{CFG.vol=+e.target.value;SB.live.forEach(a=>a.volume=CFG.vol);saveCfg()};
$("#cfgBase").onchange=e=>{CFG.base=e.target.value.trim();saveCfg()};
$("#csvUp").onclick=()=>$("#csvIn").click();
$("#csvIn").onchange=async e=>{const f=e.target.files[0];if(!f)return;const t=await f.text();e.target.value="";loadCSV(t);CFG.csv=t;saveCfg();toast("Loaded "+SB.n+" lines");openGrid()};
$("#mp3Up").onclick=()=>$("#mp3In").click();
$("#mp3In").onchange=e=>{const fs=[...e.target.files];e.target.value="";addClips(fs,null)};
$("#csvTpl").onclick=()=>saveBlob(new Blob([csvTemplate()],{type:"text/csv"}),"soundbytes.csv");
$("#csvClr").onclick=()=>{Object.values(SB.files).forEach(u=>URL.revokeObjectURL(u));SB.files={};SB.meta={};IDB.clear();CFG.csv="";saveCfg();stopAll();loadCSV("");toast("Soundbytes cleared")};

/* ---------- Local data: high scores, usernames, save file ---------- */
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
const bestOf=d=>SCORES.reduce((m,x)=>x.d===d&&x.s>m?x.s:m,0);
function addScore(s,l){
  if(s>0){
    SCORES.push({s,d:CFG.diff,n:P.name,t:Date.now(),l});
    ["easy","medium","hard"].forEach(d=>{const keep=SCORES.filter(x=>x.d===d).sort((a,b)=>b.s-a.s||b.t-a.t).slice(0,30);SCORES=SCORES.filter(x=>x.d!==d).concat(keep)});
    store.set("ts_scores",SCORES);
  }
  best=bestOf(CFG.diff);
}
function openSheet(id){if(g&&g.run)g.paused=true;$(id).hidden=false}
function closeSheet(id){$(id).hidden=true;if(g&&g.run&&![...document.querySelectorAll(".sheet")].some(x=>!x.hidden))g.paused=false}
function syncDiff(){
  best=bestOf(CFG.diff);const busy=!!(g&&g.run);
  ["#diffSeg","#diffSeg2"].forEach(id=>{const s=$(id);if(!s)return;s.textContent="";
    ["easy","medium","hard"].forEach(k=>{const b=document.createElement("button");b.textContent=k[0].toUpperCase()+k.slice(1);b.className=CFG.diff===k?"on":"";b.setAttribute("aria-pressed",String(CFG.diff===k));b.disabled=busy;b.onclick=()=>{CFG.diff=k;saveCfg();syncDiff()};s.appendChild(b)})});
  const sb=$("#startBest");if(sb)sb.textContent="Best on "+CFG.diff+": "+best+" 💎";
  const n=$("#diffNote");if(n)n.hidden=!busy;
}
let scTab=null;
function renderScores(){
  const tab=scTab||CFG.diff,s=$("#scSeg");s.textContent="";
  ["easy","medium","hard"].forEach(k=>{const b=document.createElement("button");b.textContent=k[0].toUpperCase()+k.slice(1)+" · "+bestOf(k);b.className=tab===k?"on":"";b.onclick=()=>{scTab=k;renderScores()};s.appendChild(b)});
  const l=$("#scList");l.textContent="";
  const rows=SCORES.filter(x=>x.d===tab).sort((a,b)=>b.s-a.s||b.t-a.t).slice(0,10);
  if(!rows.length){const li=document.createElement("li");li.textContent="No scores yet. Go LIVE!";l.appendChild(li)}
  rows.forEach((x,i)=>{const li=document.createElement("li"),b=document.createElement("b"),n=document.createElement("span"),e=document.createElement("em");
    b.textContent=i+1;n.textContent=x.n+" · "+x.s+" 💎";e.textContent="L"+x.l+" · "+new Date(x.t).toLocaleDateString();li.append(b,n,e);l.appendChild(li)});
}
function openScores(){scTab=CFG.diff;renderScores();openSheet("#scoreSheet")}

/* Followers of the game's TikTok account. The published list is public/followers.csv (username,bio);
   the Admin page can preview an imported list on one device and download a new followers.csv. */
const FOLLOW_ACCOUNT="@thetrollsimulator",FOLLOW_BADGE="Follower",FOLLOW_MIX=.5;
let FOLLOWERS=[],FOLLOW_SET=new Set(),FOLLOW_SRC="none";
const isFollower=name=>FOLLOW_SET.has(String(name).toLowerCase());
function followBadge(name){return isFollower(name)?'<i class="fbadge" title="Follows '+FOLLOW_ACCOUNT+' on TikTok">'+FOLLOW_BADGE+'</i>':""}
function setFollowers(list,src){
  const seen=new Set();FOLLOWERS=[];
  list.forEach(x=>{const h=cleanHandle(x&&x.n);if(!h)return;const k=("@"+h).toLowerCase();if(seen.has(k))return;seen.add(k);FOLLOWERS.push({n:"@"+h,bio:cleanBio(x.bio)})});
  FOLLOW_SET=seen;FOLLOW_SRC=src;renderFollowers();
}
function followersFromCSV(text){
  const out=[];parseCSV(String(text).replace(/^\uFEFF/,"")).forEach((r,i)=>{if(i===0&&/^user ?name$/i.test(String(r[0]).trim()))return;out.push({n:r[0],bio:r[1]})});return out;
}
/* Reads TikTok's "Download your data" export (JSON or TXT), a CSV, or a pasted list of usernames or profile links. */
function extractFollowers(text){
  let t=String(text==null?"":text).replace(/^\uFEFF/,"").trim();const out=[];
  if(/^[\[{]/.test(t)){
    let j=null;try{j=JSON.parse(t)}catch(e){}
    const walk=(v,inF)=>{
      if(Array.isArray(v))return v.forEach(x=>walk(x,inF));
      if(v&&typeof v==="object")for(const k of Object.keys(v)){const kl=k.toLowerCase(),f=inF||(/fan|follower/.test(kl)&&!/following/.test(kl));
        if(f&&/^user ?name$/i.test(k)&&typeof v[k]==="string")out.push({n:v[k]});else walk(v[k],f)}
    };
    if(j)walk(j,false);
    return out;
  }
  const sec=t.search(/follower(s)?( list)?\s*[:\n]/i);
  if(sec>=0){const rest=t.slice(sec+8),end=rest.search(/\n\s*(following|like|favorite|block|comment|hashtag)[^\n]*\n/i);t=t.slice(sec,end>=0?sec+8+end:undefined)}
  const re=/user ?name:\s*@?([A-Za-z0-9._]+)/gi;let m;while((m=re.exec(t)))out.push({n:m[1]});
  if(!out.length)followersFromCSV(t).forEach(x=>out.push(x));
  return out;
}
function initFollowers(){
  const local=store.get("ts_followers_local",null);
  if(Array.isArray(local)&&local.length)return setFollowers(local,"local");
  renderFollowers();
  try{fetch("followers.csv?v="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.text():Promise.reject()).then(t=>{if(!store.get("ts_followers_local",null))setFollowers(followersFromCSV(t),"published")}).catch(()=>{})}catch(e){}
}
function renderFollowers(){
  const st=$("#flStat");if(!has("flStat"))return;
  const n=FOLLOWERS.length;
  st.textContent=FOLLOW_SRC==="local"?"Previewing "+n+" imported follower"+(n===1?"":"s")+" on this device. Visitors still see the published list until you update followers.csv.":n+" follower"+(n===1?"":"s")+" in the published list.";
  $("#flLocal").hidden=FOLLOW_SRC!=="local";
  const l=$("#flList");l.textContent="";
  FOLLOWERS.forEach(x=>{const li=document.createElement("li"),a=document.createElement("a");a.textContent=x.n;a.href="https://www.tiktok.com/"+x.n;a.target="_blank";a.rel="noopener noreferrer";li.appendChild(a);l.appendChild(li)});
  if(!n){const li=document.createElement("li");li.textContent="No followers listed yet.";l.appendChild(li)}
}
function followersCSV(){return "username,bio\r\n"+FOLLOWERS.map(x=>x.n+","+(/[",\r\n]/.test(x.bio)?'"'+x.bio.replace(/"/g,'""')+'"':x.bio)).join("\r\n")+"\r\n"}
function importFollowers(text){
  const list=extractFollowers(text);
  const prev=new Map(FOLLOWERS.map(x=>[x.n.toLowerCase(),x.bio]));   /* keep bios you already wrote */
  list.forEach(x=>{const h=cleanHandle(x.n);if(h&&!x.bio)x.bio=prev.get(("@"+h).toLowerCase())||""});
  const ok=list.filter(x=>cleanHandle(x.n));
  if(!ok.length){toast("No follower usernames found in that file");return}
  store.set("ts_followers_local",ok);setFollowers(ok,"local");toast(FOLLOWERS.length+" followers imported");
}

/* usernames: TikTok names you submit + an optional CSV sheet (username,type) */
const cleanBio=b=>String(b==null?"":b).replace(/[\u0000-\u001f]/g," ").replace(/\s+/g," ").trim().slice(0,150);
function bioFor(name){const k=String(name).toLowerCase(),a=FOLLOWERS.find(x=>x.n.toLowerCase()===k&&x.bio)||NAMES.find(x=>x.n.toLowerCase()===k)||SHEET.find(x=>x.n.toLowerCase()===k);return a&&a.bio?a.bio:""}
function cleanHandle(raw){
  let n=String(raw==null?"":raw).trim();const m=n.match(/tiktok\.com\/@([^/?#\s]+)/i);if(m)n=m[1];n=n.replace(/^@+/,"");
  return /^[A-Za-z0-9_.]{2,24}$/.test(n)&&!n.endsWith(".")?n:null;
}
function addTikTok(raw,bio){
  const n=cleanHandle(raw);
  if(!n){toast("Enter a valid TikTok username (letters, numbers, _ and . only)");return false}
  if(NAMES.some(x=>x.n.toLowerCase()==="@"+n.toLowerCase())){toast("@"+n+" is already on the list");return false}
  if(NAMES.length>=200){toast("The list is full (200 names)");return false}
  NAMES.push({n:"@"+n,url:"https://www.tiktok.com/@"+n,bio:cleanBio(bio),t:Date.now()});store.set("ts_names",NAMES);
  toast("Added @"+n+" to the guest list");renderNames();return true;
}
function loadSheet(text){
  SHEET=[];
  parseCSV(String(text).replace(/^﻿/,"")).forEach((r,i)=>{
    if(i===0&&norm(r[0])==="username")return;
    const n=String(r[0]||"").replace(/[\u0000-\u001f]/g,"").trim().replace(/^@+/,"").slice(0,30);if(!n)return;
    const t=norm(r[1]||"");SHEET.push({n:"@"+n,type:t==="good"||t==="bad"?t:"any",bio:cleanBio(r[2])});
  });
  renderNames();
}
function genName(bad){
  if(!bad&&FOLLOWERS.length&&Math.random()<FOLLOW_MIX)return pick(FOLLOWERS).n;   /* followers only ever play friendly guests */
  const pool=[];
  SHEET.forEach(x=>{if((x.type==="any"||x.type===(bad?"bad":"good"))&&!(bad&&isFollower(x.n)))pool.push(x.n)});
  if(!bad)NAMES.forEach(x=>pool.push(x.n));   /* submitted TikTok names only ever play friendly guests */
  if(pool.length&&Math.random()<CFG.nameMix)return pick(pool);
  return "@"+pick(A)+"_"+pick(B)+ri(1,99);
}
function renderNames(){
  const l=$("#nmList");if(!l)return;l.textContent="";
  NAMES.forEach((x,i)=>{const li=document.createElement("li"),a=document.createElement("a"),b=document.createElement("button");
    a.textContent=x.n;a.href="https://www.tiktok.com/"+x.n;a.target="_blank";a.rel="noopener noreferrer";
    const w=document.createElement("div");w.className="nw";w.appendChild(a);if(x.bio){const p=document.createElement("small");p.textContent=x.bio;w.appendChild(p)}
    b.textContent="✕";b.setAttribute("aria-label","Remove "+x.n);b.onclick=()=>{NAMES.splice(i,1);store.set("ts_names",NAMES);renderNames()};li.append(w,b);l.appendChild(li)});
  if(!NAMES.length){const li=document.createElement("li");li.textContent="None yet. Add one with the form above.";l.appendChild(li)}
  $("#nmCount").textContent="("+NAMES.length+")";
  $("#nmStat").textContent=SHEET.length?SHEET.length+" names loaded from your sheet":"No username sheet loaded";
  $("#nmMix").value=CFG.nameMix;$("#nmMixV").textContent=Math.round(CFG.nameMix*100)+"%";
}
function openNames(){renderNames();openSheet("#nameSheet")}

/* save file: back up everything to a file on your computer, restore it later */
function exportSave(){
  const d={game:"troll-simulator",v:1,profile:{name:P.name,handle:P.handle},cfg:CFG,scores:SCORES,names:NAMES,sheet:store.get("ts_namesheet","")};
  saveBlob(new Blob([JSON.stringify(d,null,1)],{type:"application/json"}),"troll-simulator-save.json");
}
async function importSave(f){
  let d;try{d=JSON.parse(await f.text())}catch(e){return toast("That file isn’t a valid save file")}
  if(!d||d.game!=="troll-simulator")return toast("That file isn’t a Troll Simulator save");
  if(Array.isArray(d.scores)){
    SCORES=d.scores.filter(x=>x&&DIFF[x.d]&&Number.isFinite(x.s)&&x.s>=0).slice(0,200).map(x=>({s:Math.floor(x.s),d:x.d,n:String(x.n||"You").slice(0,24),t:Number(x.t)||Date.now(),l:Number(x.l)||1}));
    store.set("ts_scores",SCORES);
  }
  if(Array.isArray(d.names)){
    NAMES=d.names.map(x=>({h:cleanHandle(x&&x.n),b:cleanBio(x&&x.bio)})).filter(x=>x.h).slice(0,200).map(x=>({n:"@"+x.h,url:"https://www.tiktok.com/@"+x.h,bio:x.b,t:Date.now()}));
    store.set("ts_names",NAMES);
  }
  if(d.profile&&typeof d.profile==="object"){
    P.name=String(d.profile.name||P.name).slice(0,24);P.handle=String(d.profile.handle||P.handle).replace(/[^\w.]/g,"").slice(0,20)||P.handle;store.set("ts_profile",P);paint();
  }
  if(d.cfg&&typeof d.cfg==="object"){
    const c=d.cfg;if(DIFF[c.diff])CFG.diff=c.diff;
    ["sound","sfx","unmute"].forEach(k=>{if(typeof c[k]==="boolean")CFG[k]=c[k]});
    if(Number.isFinite(c.vol))CFG.vol=Math.min(1,Math.max(0,c.vol));
    if(Number.isFinite(c.nameMix))CFG.nameMix=Math.min(1,Math.max(0,c.nameMix));
    if(typeof c.base==="string")CFG.base=c.base.slice(0,200);
    if(typeof c.csv==="string"){CFG.csv=c.csv;loadCSV(c.csv)}
    saveCfg();
  }
  if(typeof d.sheet==="string"){store.set("ts_namesheet",d.sheet);loadSheet(d.sheet)}
  syncDiff();renderScores();renderNames();toast("Save file imported");
}
function initData(){
  if(!Array.isArray(SCORES)){SCORES=[];const old=store.get("ts_best",0);if(old>0)SCORES.push({s:old,d:"medium",n:"You",t:Date.now(),l:1});store.set("ts_scores",SCORES)}
  if(!Array.isArray(NAMES))NAMES=[];
  if(!DIFF[CFG.diff])CFG.diff="medium";
  const st=store.get("ts_namesheet","");
  if(st)loadSheet(st);
  else{try{fetch("usernames.csv").then(r=>r.ok?r.text():Promise.reject()).then(t=>{if(norm(t.replace(/^﻿/,"")).startsWith("username"))loadSheet(t)}).catch(()=>{})}catch(e){}}
  syncDiff();renderNames();initFollowers();
}
$("#flUp").onclick=()=>$("#flIn").click();
$("#flIn").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;if(/\.zip$/i.test(f.name))return toast("Unzip the TikTok download first, then choose the file inside it");importFollowers(await f.text())};
$("#flPasteGo").onclick=()=>{const v=$("#flPaste").value;if(!v.trim())return toast("Paste some usernames first");importFollowers(v);$("#flPaste").value=""};
$("#flDl").onclick=()=>saveBlob(new Blob([followersCSV()],{type:"text/csv"}),"followers.csv");
$("#flLocal").onclick=()=>{store.set("ts_followers_local",null);FOLLOW_SRC="none";setFollowers([],"none");initFollowers();toast("Back to the published list")};
$("#scBtn2").onclick=$("#scBtn3").onclick=$("#ftScores").onclick=openScores;
$("#nmBtn2").onclick=$("#ftNames").onclick=openNames;
$("#cfgBtn3").onclick=$("#ftCfg").onclick=openCfg;
$("#scDone").onclick=()=>closeSheet("#scoreSheet");$("#nmDone").onclick=()=>closeSheet("#nameSheet");
$("#ftForm").onsubmit=e=>{e.preventDefault();const i=$("#ftName"),b=$("#ftBio");if(addTikTok(i.value,b.value)){i.value="";b.value=""}};
$("#saveExp").onclick=exportSave;
$("#saveImp").onclick=()=>$("#saveIn").click();
$("#saveIn").onchange=e=>{const f=e.target.files[0];e.target.value="";if(f)importSave(f)};
let clrT=0;
$("#scClr").onclick=e=>{const b=e.currentTarget;
  if(!clrT){b.textContent="Tap again to clear all scores";clrT=setTimeout(()=>{clrT=0;b.textContent="Clear high scores"},3000);return}
  clearTimeout(clrT);clrT=0;b.textContent="Clear high scores";SCORES=[];store.set("ts_scores",SCORES);best=0;syncDiff();renderScores()};
$("#nmUp").onclick=()=>$("#nmIn").click();
$("#nmIn").onchange=async e=>{const f=e.target.files[0];if(!f)return;const t=await f.text();e.target.value="";store.set("ts_namesheet",t);loadSheet(t);toast(SHEET.length+" usernames loaded")};
$("#nmTpl").onclick=()=>saveBlob(new Blob(["username,type,bio\r\n@example_fan,good,Loves cozy streams\r\n@example_troll,bad,here for chaos\r\n@example_anyone,any,\r\n"],{type:"text/csv"}),"usernames.csv");
$("#nmClr").onclick=()=>{store.set("ts_namesheet","");loadSheet("")};
$("#nmMix").oninput=e=>{CFG.nameMix=+e.target.value;saveCfg();$("#nmMixV").textContent=Math.round(CFG.nameMix*100)+"%"};

/* ---------- Soundbyte grid: drag and drop mp3 files onto the lines ---------- */
let gridTarget=null,prevA=null;
function rowsToCSV(){
  const q=s=>/[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s,k4=SB.rows.some(r=>r.k);
  const out=["difficulty,Text They Say,mp3file"+(k4?",type":"")];
  SB.rows.forEach(r=>out.push(r.d+","+q(r.t)+","+q(r.f)+(k4?","+(r.k||""):"")));
  return out.join("\r\n")+"\r\n";
}
function commitRows(){const t=rowsToCSV();CFG.csv=t;saveCfg();loadCSV(t);renderGrid()}
function clipLen(url){return new Promise(res=>{const a=new Audio();a.preload="metadata";
  a.onloadedmetadata=()=>res(isFinite(a.duration)?a.duration:0);a.onerror=()=>res(-1);a.src=url;setTimeout(()=>res(0),4000)})}
async function addClips(fs,row){
  const acc=[],bad=[];
  for(const f of fs){
    if(!/\.mp3$/i.test(f.name)&&f.type!=="audio/mpeg"){bad.push(f.name+" (not an mp3)");continue}
    if(f.size>CFG.maxKB*1024){bad.push(f.name+" (over "+CFG.maxKB+" KB)");continue}
    const url=URL.createObjectURL(f),sec=await clipLen(url);
    if(sec<0){URL.revokeObjectURL(url);bad.push(f.name+" (can’t be read)");continue}
    if(sec>CFG.maxSec){URL.revokeObjectURL(url);bad.push(f.name+" (over "+CFG.maxSec+" s)");continue}
    const k=f.name.toLowerCase();if(SB.files[k])URL.revokeObjectURL(SB.files[k]);
    SB.files[k]=url;SB.meta[k]={kb:Math.max(1,Math.round(f.size/1024)),sec};IDB.put(k,f,SB.meta[k]);acc.push(f.name);
  }
  if(row&&acc.length&&SB.rows.includes(row)){row.f=acc[0];commitRows()}else renderGrid();
  sbStatus();
  const unused=acc.filter(n=>!SB.rows.some(r=>r.f.toLowerCase()===n.toLowerCase())).length;
  toast((acc.length?acc.length+" mp3 added"+(unused?" · "+unused+" not used by any line":""):"No mp3 added")+(bad.length?" · skipped: "+bad.join(", "):""),bad.length?6000:2600);
}
function rowStatus(r){
  if(!r.f)return{t:"No mp3 · silent",c:""};
  const k=r.f.toLowerCase(),m=SB.meta[k];
  if(SB.files[k])return{t:"✓ "+(m?m.kb+" KB"+(m.sec>0?" · "+m.sec.toFixed(1)+" s":""):"uploaded"),c:"ok"};
  return{t:"Not uploaded · from "+(/^(https?:)?\/\//.test(r.f)||r.f[0]==="/"?"URL":(CFG.base||"./")),c:"warn"};
}
function preview(f){try{if(prevA){prevA.pause();prevA=null}const a=new Audio(fileUrl(f));a.volume=CFG.vol;prevA=a;a.play().catch(()=>toast("Couldn’t play "+f))}catch(e){}}
function renderGrid(){
  const el=$("#grid");if(!el)return;el.textContent="";
  $("#gridInfo").textContent=SB.rows.length+" lines · "+SB.a+" linked · "+Object.keys(SB.files).length+" mp3 uploaded · max "+CFG.maxKB+" KB and "+CFG.maxSec+" s per clip";
  SB.rows.forEach((r,i)=>{
    const row=document.createElement("div"),top=document.createElement("div"),d=document.createElement("span"),t=document.createElement("span"),
      slot=document.createElement("div"),n=document.createElement("span"),s=document.createElement("span"),st=rowStatus(r);
    row.className="grow";top.className="gtop";d.className="gd";d.textContent=r.d;t.className="gt";t.textContent=r.t;
    slot.className="gslot "+st.c;slot.dataset.i=i;slot.tabIndex=0;slot.setAttribute("role","button");slot.setAttribute("aria-label","Add an mp3 for: "+r.t);
    n.className="gn";n.textContent=r.f||"Drop an mp3 here or tap to choose";s.className="gs";s.textContent=st.t;slot.append(n,s);
    if(r.f){
      const p=document.createElement("button"),x=document.createElement("button");
      p.textContent="▶";p.setAttribute("aria-label","Preview");p.onclick=e=>{e.stopPropagation();preview(r.f)};
      x.textContent="✕";x.setAttribute("aria-label","Unlink mp3");x.onclick=e=>{e.stopPropagation();r.f="";commitRows()};slot.append(p,x);
    }
    slot.onclick=()=>{gridTarget=r;$("#gridIn").click()};
    slot.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();slot.click()}};
    top.append(d,t);row.append(top,slot);el.appendChild(row);
  });
  if(!SB.rows.length){const p=document.createElement("p");p.textContent="No lines yet. Upload a soundbytes CSV in Settings.";el.appendChild(p)}
}
function openGrid(){renderGrid();openSheet("#gridSheet")}

/* max clip size comes from a text file: config.txt */
function parseLimits(text){
  String(text).split(/\r?\n/).forEach(line=>{
    const m=line.replace(/#.*$/,"").trim().match(/^([A-Za-z_]+)\s*[=:]\s*([0-9.]+)$/);if(!m)return;
    const k=m[1].toLowerCase(),v=parseFloat(m[2]);if(!isFinite(v))return;
    if(k==="max_clip_kb")CFG.maxKB=Math.min(20000,Math.max(10,v));
    else if(k==="max_clip_seconds")CFG.maxSec=Math.min(60,Math.max(.5,v));
  });
  saveCfg();sbStatus();
}
function initLimits(){
  if(CFG.cfgTxt)parseLimits(CFG.cfgTxt);
  else{try{fetch("config.txt").then(r=>r.ok?r.text():Promise.reject()).then(t=>{if(/max_clip/i.test(t))parseLimits(t)}).catch(()=>{})}catch(e){}}
  sbStatus();
}
const gd=$("#gridDrop"),clearDrag=()=>{gd.classList.remove("drag");document.querySelectorAll(".gslot.drag").forEach(x=>x.classList.remove("drag"))};
["dragenter","dragover"].forEach(ev=>gd.addEventListener(ev,e=>{e.preventDefault();clearDrag();gd.classList.add("drag");const s=e.target.closest&&e.target.closest(".gslot");if(s)s.classList.add("drag")}));
gd.addEventListener("dragleave",e=>{if(!gd.contains(e.relatedTarget))clearDrag()});
gd.addEventListener("drop",e=>{e.preventDefault();clearDrag();
  const fs=[...(e.dataTransfer?e.dataTransfer.files:[])];if(!fs.length)return;
  const s=e.target.closest&&e.target.closest(".gslot");addClips(fs,s?SB.rows[+s.dataset.i]:null)});
addEventListener("dragover",e=>e.preventDefault());addEventListener("drop",e=>e.preventDefault());   /* a missed drop must not navigate away */
$("#gridBtn").onclick=openGrid;$("#gridDone").onclick=()=>closeSheet("#gridSheet");
$("#gridAdd").onclick=()=>{gridTarget=null;$("#gridIn").click()};
$("#gridIn").onchange=e=>{const fs=[...e.target.files];e.target.value="";const row=gridTarget;gridTarget=null;addClips(fs,row)};
$("#gridCsv").onclick=()=>saveBlob(new Blob([rowsToCSV()],{type:"text/csv"}),"soundbytes.csv");
$("#limUp").onclick=()=>$("#limIn").click();
$("#limIn").onchange=async e=>{const f=e.target.files[0];if(!f)return;const t=await f.text();e.target.value="";CFG.cfgTxt=t;parseLimits(t);toast("Limits: "+CFG.maxKB+" KB, "+CFG.maxSec+" s")};
$("#limTpl").onclick=()=>saveBlob(new Blob(["# Troll Simulator config. Lines starting with # are comments.\r\n# Largest allowed mp3 clip, in kilobytes\r\nmax_clip_kb=1024\r\n# Longest allowed clip, in seconds\r\nmax_clip_seconds=10\r\n"],{type:"text/plain"}),"config.txt");

/* ---------- Wire up ---------- */
$("#how").innerHTML=[["🎥","You’re the creator. Guests join and take the boxes."],["🔗","Watch who shares the LIVE link. Friends join through it."],["😇","Some guests are great. Some act nice for a while, then team up and yell #@$%!"],["🎙️","Tap a mic to mute. Muted guests can switch it back on at random, so remove or block repeat offenders."],["🛡️","Yelling drains community health. Wrongly removing good guests costs you."]].map(([i,t])=>"<div><span>"+i+"</span><span>"+t+"</span></div>").join("");
$("#playBtn").onclick=()=>{$("#hostName").textContent=P.name;goLive()};$("#again").onclick=goLive;
$("#helpBtn").onclick=()=>{if(g&&g.run)toast("Check account age, reports and who they joined via. Raids wait until everyone is seated.");else $("#start").hidden=false};
$("#folBtn").onclick=e=>{const b=e.currentTarget;b.classList.toggle("on");b.textContent=b.classList.contains("on")?"Following":"Follow";b.setAttribute("aria-pressed",String(b.classList.contains("on")))};
$("#endBtn").onclick=()=>{if(g&&g.run)endLive("You ended the LIVE");else $("#start").hidden=false};
$("#likeBtn").onclick=e=>{const r=e.currentTarget.getBoundingClientRect();for(let i=0;i<4;i++)setTimeout(()=>heart(r.left+Math.random()*30,r.top-10),i*90)};
$("#chatIn").addEventListener("keydown",e=>{if(e.key!=="Enter")return;const v=e.target.value.trim();if(!v||!g||!g.run)return;e.target.value="";cl("You",v,"me")});
$("#uClose").onclick=closeUser;
$("#profBtn").onclick=()=>{$("#nameIn").value=P.name;$("#handleIn").value=P.handle;swatches();$("#profSheet").hidden=false};
$("#profDone").onclick=()=>{P.name=$("#nameIn").value.trim()||"Troll Whisperer";P.handle=($("#handleIn").value.trim()||"troll.whisperer").replace(/[^\w.]/g,"");store.set("ts_profile",P);paint();$("#profSheet").hidden=true};
$("#shareBtn").onclick=shareScore;$("#shareScore").onclick=shareScore;$("#saveCard").onclick=saveCard;
$("#acctBtn").onclick=openAcct;$("#acctClose").onclick=()=>$("#acctSheet").hidden=true;
$("#gBtn").onclick=()=>AUTH.google();$("#ttBtn").onclick=()=>AUTH.tiktok();$("#outBtn").onclick=signOut;
/* ---------- Accessibility: layouts, pause, dialogs, keyboard ---------- */
function setLayout(l){
  if(!LAYOUTS[l])l="grid";layout=l;store.set("ts_layout",l);
  $("#boxes").className="boxes z "+l;
  const b=$("#layoutBtn");b.textContent=LAYOUTS[l][0];b.setAttribute("aria-label","Switch layout. Current layout: "+LAYOUTS[l][1]);
}
function setHold(v){
  if(g)g.hold=v;const b=$("#pauseBtn");
  b.textContent=v?"▶":"❚❚";b.setAttribute("aria-pressed",String(v));b.setAttribute("aria-label",v?"Resume LIVE":"Pause LIVE");
}
const findBoxUser=id=>g?g.boxes.find(x=>x&&x.id===id):null;
function boxAct(t){
  const b=t.closest&&t.closest("[data-act]");if(!b||!g||!g.run)return;
  const u=findBoxUser(+b.dataset.u);if(!u)return;
  if(b.dataset.act==="mute")act(u,"mute");else openUser(u);
}
/* pointerdown keeps taps instant even when the boxes redraw; keyboard "click" events (detail 0) cover Enter and Space */
$("#boxes").addEventListener("pointerdown",e=>{
  if(e.pointerType==="mouse"&&e.button!==0)return;
  if(e.target.closest("[data-act]")){e.preventDefault();boxAct(e.target)}
});
$("#boxes").addEventListener("click",e=>{if(e.detail===0)boxAct(e.target)});

const DLG={start:"The Troll Simulator",end:"LIVE ended",userSheet:"Guest profile",profSheet:"Edit profile",acctSheet:"Account",cfgSheet:"Settings",scoreSheet:"High scores",nameSheet:"Usernames",gridSheet:"Soundbyte grid",moreSheet:"More"};
let opener=null,topDlg=null;
const visDialogs=()=>[...$("#phone").querySelectorAll(".sheet,.over")].filter(x=>!x.hidden);
function syncDialogs(){
  const ph=$("#phone"),vis=visDialogs(),top=vis[vis.length-1]||null;
  [...ph.children].forEach(c=>{if(top&&c!==top)c.setAttribute("inert","");else c.removeAttribute("inert")});
  if(g&&g.run)g.paused=vis.some(x=>x.classList.contains("sheet"));
  if(top&&top!==topDlg){
    if(!topDlg)opener=document.activeElement;
    ph.scrollTop=0;const card=top.querySelector(".card");
    if(card){card.tabIndex=-1;card.focus({preventScroll:true})}
  }else if(!top&&topDlg){
    const o=opener;opener=null;if(o&&o.isConnected&&o.focus)o.focus({preventScroll:true});
  }
  topDlg=top;
}
Object.entries(DLG).forEach(([id,label])=>{
  const el=$("#"+id);if(!el)return;
  el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");el.setAttribute("aria-label",label);
  new MutationObserver(syncDialogs).observe(el,{attributes:true,attributeFilter:["hidden"]});
});
addEventListener("keydown",e=>{
  if(e.key!=="Escape")return;
  const vis=visDialogs(),top=vis[vis.length-1];
  if(top&&top.classList.contains("sheet")){e.preventDefault();top.hidden=true}
});
$("#moreSheet").addEventListener("click",e=>{if(e.target.closest("button"))$("#moreSheet").hidden=true});
$("#moreBtn").onclick=()=>$("#moreSheet").hidden=false;
$("#moreDone").onclick=()=>$("#moreSheet").hidden=true;$("#shareQuick").onclick=shareScore;
$("#layoutBtn").onclick=()=>{const k=Object.keys(LAYOUTS);setLayout(k[(k.indexOf(layout)+1)%k.length])};
$("#pauseBtn").onclick=()=>{if(g&&g.run)setHold(!g.hold)};
$("#cfgRelaxed").onchange=e=>{CFG.relaxed=e.target.checked;saveCfg()};
setLayout(layout);

paint();hud();initSB();initData();initLimits();if(has("cfgBase"))syncCfg();
if(has("phone")){renderAcct();handleAuthReturn().then(checkSession)}
