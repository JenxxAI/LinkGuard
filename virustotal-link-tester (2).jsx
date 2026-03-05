import { useState, useRef, useEffect, useCallback } from "react";

const DARK={bg:"#0a0a0f",surface:"#111118",border:"#1e1e2e",text:"#e8e6f0",muted:"#5a5a7a",code:"#a0a0c8",green:"#00ff9d",red:"#ff3c5c",yellow:"#ffe566",blue:"#5b8cff",inputBg:"#0d0d14",cardBg:"#13131f"};
const LIGHT={bg:"#f0f0f5",surface:"#ffffff",border:"#e0dfe8",text:"#1a1a2e",muted:"#8888aa",code:"#444466",green:"#00a86b",red:"#e8294a",yellow:"#c47d00",blue:"#2f5fd4",inputBg:"#f8f8fc",cardBg:"#f4f4fa"};
const FONTS=`@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap');`;

function getRisk(m,s,tot){
  if(!tot)return{score:0,label:"Unknown",color:null};
  const p=Math.round(((m+s*0.5)/tot)*100);
  if(!m&&!s)return{score:0,label:"Clean",color:"green"};
  if(!m&&s<=2)return{score:p,label:"Low Risk",color:"yellow"};
  if(m<=4)return{score:p,label:"Medium Risk",color:"yellow"};
  if(m<=10)return{score:p,label:"High Risk",color:"red"};
  return{score:p,label:"Dangerous",color:"red"};
}
function timeAgo(ts){const d=Date.now()-ts;if(d<60000)return"just now";if(d<3600000)return`${Math.floor(d/60000)}m ago`;if(d<86400000)return`${Math.floor(d/3600000)}h ago`;return`${Math.floor(d/86400000)}d ago`;}
function shortUrl(u){try{const x=new URL(u);return x.hostname+(x.pathname.length>1?x.pathname.slice(0,20)+(x.pathname.length>20?"…":""):"");}catch{return u.slice(0,35)+(u.length>35?"…":"");}}

// ── Radar Chart (SVG, no deps) ──────────────────────────────────────────
function RadarChart({mal,sus,har,und,t}){
  const tot=mal+sus+har+und||1;
  const labels=["Malicious","Suspicious","Harmless","Undetected"];
  const vals=[mal/tot,sus/tot,har/tot,und/tot];
  const colors=[t.red,t.yellow,t.green,t.muted];
  const cx=80,cy=80,r=55,n=4;
  const pts=vals.map((v,i)=>{const a=(i/n)*2*Math.PI-Math.PI/2;return[cx+r*v*Math.cos(a),cy+r*v*Math.sin(a)];});
  const poly=pts.map(p=>p.join(",")).join(" ");
  const axes=Array.from({length:n},(_,i)=>{const a=(i/n)*2*Math.PI-Math.PI/2;return[cx+r*Math.cos(a),cy+r*Math.sin(a)];});
  const labelPos=Array.from({length:n},(_,i)=>{const a=(i/n)*2*Math.PI-Math.PI/2;return[cx+(r+18)*Math.cos(a),cy+(r+14)*Math.sin(a)];});
  return(
    <svg viewBox="0 0 160 160" width="160" height="160" style={{overflow:"visible"}}>
      {[0.25,0.5,0.75,1].map((sc,i)=>{
        const gpts=Array.from({length:n},(_,j)=>{const a=(j/n)*2*Math.PI-Math.PI/2;return`${cx+r*sc*Math.cos(a)},${cy+r*sc*Math.sin(a)}`;}).join(" ");
        return <polygon key={i} points={gpts} fill="none" stroke={t.border} strokeWidth="1"/>;
      })}
      {axes.map(([x,y],i)=><line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={t.border} strokeWidth="1"/>)}
      <polygon points={poly} fill={`${t.red}22`} stroke={t.red} strokeWidth="2"/>
      {pts.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="4" fill={colors[i]}/>)}
      {labelPos.map(([x,y],i)=>(
        <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill={colors[i]}
          style={{fontFamily:"Space Mono",fontSize:8,fontWeight:700}}>{labels[i]}</text>
      ))}
    </svg>
  );
}

// ── Donut Chart ────────────────────────────────────────────────────────
function DonutChart({mal,sus,har,und,t}){
  const tot=mal+sus+har+und;if(!tot)return null;
  const segs=[{v:mal,c:t.red},{v:sus,c:t.yellow},{v:har,c:t.green},{v:und,c:t.muted}];
  let offset=0;const r=36,cx=50,cy=50,circ=2*Math.PI*r;
  return(
    <svg viewBox="0 0 100 100" width="90" height="90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.border} strokeWidth="14"/>
      {segs.map((seg,i)=>{
        if(!seg.v)return null;
        const dash=(seg.v/tot)*circ,space=circ-dash,rot=offset;
        offset+=dash;
        return<circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.c} strokeWidth="14"
          strokeDasharray={`${dash} ${space}`} strokeDashoffset={-rot+circ/4}
          style={{transition:"stroke-dasharray 0.6s"}}/>;
      })}
      <text x={cx} y={cy-5} textAnchor="middle" fill={t.text} style={{fontFamily:"Space Mono",fontSize:11,fontWeight:700}}>{tot}</text>
      <text x={cx} y={cy+8} textAnchor="middle" fill={t.muted} style={{fontFamily:"Space Mono",fontSize:7}}>engines</text>
    </svg>
  );
}

// ── Gauge ──────────────────────────────────────────────────────────────
function RiskGauge({score,label,colorKey,t}){
  const angle=-135+(score/100)*270,color=t[colorKey]||t.muted;
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <svg viewBox="0 0 120 80" width="100" height="67">
        <path d="M10 70 A50 50 0 0 1 110 70" fill="none" stroke={t.border} strokeWidth="10" strokeLinecap="round"/>
        <path d="M10 70 A50 50 0 0 1 110 70" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray="157" strokeDashoffset={157-(score/100)*157} style={{transition:"stroke-dashoffset 0.9s"}}/>
        <line x1="60" y1="70" x2="60" y2="28" stroke={color} strokeWidth="3" strokeLinecap="round"
          style={{transformOrigin:"60px 70px",transform:`rotate(${angle}deg)`,transition:"transform 0.9s"}}/>
        <circle cx="60" cy="70" r="5" fill={color}/>
        <text x="60" y="60" textAnchor="middle" fill={t.text} style={{fontFamily:"Space Mono",fontSize:15,fontWeight:700}}>{score}</text>
      </svg>
      <span style={{fontFamily:"Space Mono",fontSize:10,fontWeight:700,color,letterSpacing:1}}>{label.toUpperCase()}</span>
    </div>
  );
}

// ── Threat Bar ─────────────────────────────────────────────────────────
function ThreatBar({mal,sus,har,und,t}){
  const tot=mal+sus+har+und;if(!tot)return null;
  const segs=[{v:mal,c:t.red,l:"Malicious"},{v:sus,c:t.yellow,l:"Suspicious"},{v:har,c:t.green,l:"Harmless"},{v:und,c:t.muted,l:"Undetected"}].filter(s=>s.v>0);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <div style={{display:"flex",height:8,borderRadius:99,overflow:"hidden",gap:1}}>
        {segs.map((s,i)=><div key={i} style={{flex:s.v,background:s.c,borderRadius:99,transition:"flex 0.6s"}}/>)}
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        {segs.map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:7,height:7,borderRadius:2,background:s.c}}/>
            <span style={{fontSize:10,fontFamily:"Space Mono",color:t.muted}}>{s.l} <span style={{color:t.text}}>{s.v}</span><span style={{opacity:0.5}}> {Math.round(s.v/tot*100)}%</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Category Tags ──────────────────────────────────────────────────────
function CategoryTags({categories,t}){
  if(!categories||!Object.keys(categories).length)return null;
  const unique=[...new Set(Object.values(categories))];
  const bad=["malware","phishing","spam","malicious","suspicious","unwanted","abuse"];
  return(
    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
      {unique.map((cat,i)=>{
        const isBad=bad.some(b=>cat.toLowerCase().includes(b));
        return<span key={i} style={{padding:"2px 9px",borderRadius:99,fontSize:10,fontFamily:"Space Mono",fontWeight:700,background:isBad?`${t.red}18`:`${t.green}18`,color:isBad?t.red:t.green,border:`1px solid ${isBad?t.red:t.green}33`,textTransform:"uppercase",letterSpacing:0.5}}>{cat}</span>;
      })}
    </div>
  );
}

// ── SSL Card ───────────────────────────────────────────────────────────
function SSLCard({ssl,t}){
  if(!ssl)return<InfoRow icon="🔓" label="SSL" value="No certificate data available" color={t.muted} t={t}/>;
  const exp=ssl.cert_validity_date?new Date(ssl.cert_validity_date*1000).toLocaleDateString():"N/A";
  const valid=ssl.cert_validity_date?(ssl.cert_validity_date*1000>Date.now()):null;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:6,padding:"12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${valid===false?t.red:t.border}`}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
        <span>{valid===false?"🔓":"🔒"}</span>
        <span style={{fontFamily:"Space Mono",fontSize:11,fontWeight:700,color:valid===false?t.red:t.green}}>{valid===false?"EXPIRED SSL":valid?"VALID SSL":"SSL INFO"}</span>
      </div>
      {[["Issuer",ssl.cert_issuer],["Subject",ssl.cert_subject],["Expires",exp],["Serial",ssl.cert_serial_number]].filter(([,v])=>v&&v!=="N/A").map(([k,v])=>(
        <div key={k} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
          <span style={{fontFamily:"Space Mono",fontSize:9,color:t.muted,minWidth:52,textTransform:"uppercase",letterSpacing:0.5,paddingTop:1}}>{k}</span>
          <span style={{fontFamily:"Space Mono",fontSize:10,color:t.code,wordBreak:"break-all"}}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function InfoRow({icon,label,value,color,t,mono=true}){
  return(
    <div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"9px 12px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.border}`}}>
      <span style={{fontSize:14,flexShrink:0}}>{icon}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:9,fontFamily:"Space Mono",color:t.muted,textTransform:"uppercase",letterSpacing:0.8,marginBottom:2}}>{label}</div>
        <div style={{fontSize:11,fontFamily:mono?"Space Mono":"Syne",color:color||t.text,wordBreak:"break-all"}}>{value||"—"}</div>
      </div>
    </div>
  );
}

// ── History Item ───────────────────────────────────────────────────────
function HistoryItem({item,onReload,t}){
  const risk=getRisk(item.malicious,item.suspicious,item.total),color=t[risk.color]||t.muted;
  return(
    <div onClick={()=>onReload(item)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.border}`,cursor:"pointer",transition:"border-color 0.2s"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor=color} onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}>
      <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0,boxShadow:`0 0 5px ${color}88`}}/>
      <div style={{flex:1,overflow:"hidden"}}>
        <div style={{fontFamily:"Space Mono",fontSize:11,color:t.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{shortUrl(item.url)}</div>
        <div style={{fontSize:9,color:t.muted,marginTop:1}}>{timeAgo(item.timestamp)} · {risk.label} · {item.malicious+item.suspicious}/{item.total}</div>
      </div>
      <span style={{fontSize:10,color,fontFamily:"Space Mono",flexShrink:0}}>{risk.label}</span>
    </div>
  );
}

// ── Tab Button ─────────────────────────────────────────────────────────
function TabBtn({label,active,onClick,t,dark}){
  return(
    <button onClick={onClick} style={{flex:1,padding:"8px 6px",borderRadius:9,border:"none",cursor:"pointer",
      background:active?t.green:"transparent",color:active?(dark?"#0a0a0f":"#fff"):t.muted,
      fontFamily:"Syne",fontWeight:700,fontSize:12,transition:"all 0.2s",whiteSpace:"nowrap"}}>
      {label}
    </button>
  );
}

// ── Bulk Row ───────────────────────────────────────────────────────────
function BulkRow({item,t}){
  const risk=item.result?getRisk(item.result.malicious,item.result.suspicious,item.result.total):{score:0,label:item.status==="error"?"Error":item.status,color:null};
  const color=t[risk.color]||t.muted;
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:10,background:t.inputBg,border:`1px solid ${color}44`}}>
      <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0,boxShadow:item.result?`0 0 5px ${color}66`:"none"}}/>
      <div style={{flex:1,overflow:"hidden"}}>
        <div style={{fontFamily:"Space Mono",fontSize:10,color:t.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{shortUrl(item.url)}</div>
        {item.result&&<div style={{fontSize:9,color:t.muted,marginTop:1}}>{item.result.malicious+item.result.suspicious}/{item.result.total} engines flagged</div>}
      </div>
      <span style={{fontSize:10,fontFamily:"Space Mono",color,flexShrink:0,textAlign:"right"}}>{risk.label}</span>
    </div>
  );
}

// ── Feed Item (community) ──────────────────────────────────────────────
function FeedItem({item,t}){
  const risk=getRisk(item.malicious,item.suspicious,item.total),color=t[risk.color]||t.muted;
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.border}`}}>
      <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}}/>
      <div style={{flex:1,overflow:"hidden"}}>
        <div style={{fontFamily:"Space Mono",fontSize:10,color:t.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{shortUrl(item.url)}</div>
        <div style={{fontSize:9,color:t.muted,marginTop:1}}>{timeAgo(item.ts)} · {item.malicious+item.suspicious}/{item.total} flagged</div>
      </div>
      <span style={{fontSize:10,fontFamily:"Space Mono",color,flexShrink:0}}>{risk.label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════
export default function App(){
  const [dark,setDark]=useState(true);
  const t=dark?DARK:LIGHT;
  const [apiKey,setApiKey]=useState(()=>{try{return sessionStorage.getItem("vt_key")||""}catch{return ""}});
  const [url,setUrl]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);
  const [result,setResult]=useState(null);
  const [scannedUrl,setScannedUrl]=useState("");
  const [phase,setPhase]=useState(null);
  const [tab,setTab]=useState("overview");
  const [history,setHistory]=useState(()=>{try{return JSON.parse(sessionStorage.getItem("vt_history")||"[]")}catch{return []}});
  const [shareMsg,setShareMsg]=useState(null);
  const [copyMsg,setCopyMsg]=useState(null);
  const [bulkMode,setBulkMode]=useState(false);
  const [bulkText,setBulkText]=useState("");
  const [bulkResults,setBulkResults]=useState([]);
  const [bulkRunning,setBulkRunning]=useState(false);
  const [communityFeed,setCommunityFeed]=useState([]);
  const [feedLoading,setFeedLoading]=useState(false);
  const [dragOver,setDragOver]=useState(false);
  const pollRef=useRef(null);
  const fileRef=useRef(null);

  useEffect(()=>{try{if(apiKey)sessionStorage.setItem("vt_key",apiKey)}catch{}},[apiKey]);
  useEffect(()=>{try{sessionStorage.setItem("vt_history",JSON.stringify(history))}catch{}},[history]);

  // Load community feed from storage
  const loadFeed=useCallback(async()=>{
    setFeedLoading(true);
    try{
      const r=await window.storage.get("linkguard_feed",true);
      if(r){const feed=JSON.parse(r.value);setCommunityFeed(feed.slice(0,30));}
    }catch{}
    setFeedLoading(false);
  },[]);

  useEffect(()=>{ if(tab==="community")loadFeed(); },[tab,loadFeed]);

  const saveFeedEntry=async(entry)=>{
    try{
      const r=await window.storage.get("linkguard_feed",true);
      const existing=r?JSON.parse(r.value):[];
      const updated=[entry,...existing.filter(x=>x.url!==entry.url).slice(0,49)];
      await window.storage.set("linkguard_feed",JSON.stringify(updated),true);
    }catch{}
  };

  // ── single scan ──────────────────────────────────────────────────────
  const doScan=useCallback(async(su,sk,silent=false)=>{
    if(!sk?.trim()){if(!silent)setError("Enter your VirusTotal API key.");return null;}
    if(!su?.trim()){if(!silent)setError("Enter a URL to scan.");return null;}
    if(!silent){setError(null);setResult(null);setLoading(true);setPhase("submitting");setScannedUrl(su.trim());setTab("overview");}
    try{
      const fd=new URLSearchParams();fd.append("url",su.trim());
      const r=await fetch("https://www.virustotal.com/api/v3/urls",{method:"POST",headers:{"x-apikey":sk.trim(),"Content-Type":"application/x-www-form-urlencoded"},body:fd.toString()});
      if(!r.ok){const e=await r.json();throw new Error(e?.error?.message||`HTTP ${r.status}`);}
      const id=(await r.json()).data?.id;
      if(!id)throw new Error("No analysis ID.");
      if(!silent)setPhase("polling");
      let attempts=0;
      return await new Promise((resolve,reject)=>{
        const poll=async()=>{
          if(++attempts>24){reject(new Error("Timed out"));return;}
          const pr=await fetch(`https://www.virustotal.com/api/v3/analyses/${id}`,{headers:{"x-apikey":sk.trim()}});
          const pd=await pr.json();
          if(pd.data?.attributes?.status==="completed"){
            const attrs=pd.data.attributes;
            if(!silent){setResult(attrs);setPhase("done");setLoading(false);}
            const s=attrs?.stats||{},m=s.malicious||0,ss=s.suspicious||0,h=s.harmless||0,u=s.undetected||0,tot=m+ss+h+u+(s.timeout||0);
            const entry={url:su.trim(),timestamp:Date.now(),malicious:m,suspicious:ss,harmless:h,undetected:u,total:tot,result:attrs};
            if(!silent){
              setHistory(prev=>[entry,...prev.filter(x=>x.url!==su.trim()).slice(0,19)]);
              saveFeedEntry({url:su.trim(),ts:Date.now(),malicious:m,suspicious:ss,total:tot});
            }
            resolve({malicious:m,suspicious:ss,harmless:h,undetected:u,total:tot,attrs});
          }else{pollRef.current=setTimeout(poll,3000);}
        };poll();
      });
    }catch(e){
      if(!silent){setError(e.message||"Error occurred.");setLoading(false);setPhase(null);}
      throw e;
    }
  },[]);

  // ── bulk scan ────────────────────────────────────────────────────────
  const runBulk=async()=>{
    const urls=bulkText.split(/\n|,/).map(x=>x.trim()).filter(x=>x.startsWith("http"));
    if(!urls.length){setError("No valid URLs found (must start with http).");return;}
    if(!apiKey.trim()){setError("Enter your API key first.");return;}
    setError(null);setBulkResults(urls.map(u=>({url:u,status:"queued",result:null})));setBulkRunning(true);
    for(let i=0;i<urls.length;i++){
      setBulkResults(prev=>prev.map((x,j)=>j===i?{...x,status:"scanning"}:x));
      await new Promise(res=>setTimeout(res,i>0?15500:0)); // respect 4/min rate limit
      try{
        const res=await doScan(urls[i],apiKey,true);
        setBulkResults(prev=>prev.map((x,j)=>j===i?{...x,status:"done",result:res}:x));
      }catch(e){
        setBulkResults(prev=>prev.map((x,j)=>j===i?{...x,status:"error",result:null}:x));
      }
    }
    setBulkRunning(false);
  };

  // ── drag & drop ──────────────────────────────────────────────────────
  const onDrop=e=>{
    e.preventDefault();setDragOver(false);
    const text=e.dataTransfer.getData("text/plain")||e.dataTransfer.getData("text/uri-list");
    if(text)setUrl(text.trim());
  };

  // ── share / copy ─────────────────────────────────────────────────────
  const handleShare=()=>{try{const d=btoa(JSON.stringify({u:scannedUrl,k:apiKey}));navigator.clipboard.writeText(`${window.location.href.split("#")[0]}#${d}`);setShareMsg("Copied!");setTimeout(()=>setShareMsg(null),2000);}catch{setShareMsg("Error");}};
  const handleCopy=()=>{if(!result)return;const s=result.stats||{},m=s.malicious||0,ss=s.suspicious||0,tot=m+ss+(s.harmless||0)+(s.undetected||0),risk=getRisk(m,ss,tot);navigator.clipboard.writeText(`🔍 LinkGuard Scan\n🔗 ${scannedUrl}\n⚠️ Risk: ${risk.label} (${risk.score}/100)\n🔴 Malicious: ${m}  🟡 Suspicious: ${ss}  ✅ Harmless: ${s.harmless||0}\n📊 ${tot} engines checked`);setCopyMsg("Copied!");setTimeout(()=>setCopyMsg(null),2000);};

  const reset=()=>{clearTimeout(pollRef.current);setResult(null);setError(null);setLoading(false);setPhase(null);setUrl("");setScannedUrl("");};

  // ── derived state ────────────────────────────────────────────────────
  const s=result?.stats||{},mal=s.malicious||0,sus=s.suspicious||0,har=s.harmless||0,und=s.undetected||0,tot=mal+sus+har+und+(s.timeout||0);
  const risk=getRisk(mal,sus,tot),rc=t[risk.color]||t.muted;
  const engines=result?.results?Object.entries(result.results):[];
  const flagged=engines.filter(([,v])=>v.category==="malicious"||v.category==="suspicious");
  const clean=engines.filter(([,v])=>v.category==="harmless"||v.category==="undetected");
  const ssl=result?.last_https_certificate;
  const redirects=result?.redirection_chain||[];
  const lastAnalysisDate=result?.date?new Date(result.date*1000).toLocaleString():null;

  const TABS=result?["Overview","Intel","Charts","Engines","SSL","History","Community"]:["History","Community"];

  // ── render ───────────────────────────────────────────────────────────
  return(<>
    <style>{FONTS+`
      *{box-sizing:border-box;margin:0;padding:0;}
      body{background:${t.bg};color:${t.text};font-family:'Syne',sans-serif;transition:background 0.3s,color 0.3s;-webkit-tap-highlight-color:transparent;}
      details summary{list-style:none;cursor:pointer;}
      details summary::-webkit-details-marker{display:none;}
      ::-webkit-scrollbar{width:4px;}
      ::-webkit-scrollbar-thumb{background:${t.border};border-radius:99px;}
      input,textarea{transition:border-color 0.2s;-webkit-appearance:none;}
      input::placeholder,textarea::placeholder{color:${t.muted};}
      @keyframes slide{0%{margin-left:-40%}100%{margin-left:100%}}
      @keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      .fadein{animation:fadein 0.35s ease both;}
      .dropzone-active{border-color:${t.green}!important;background:${t.green}0a!important;}
    `}</style>

    <div style={{minHeight:"100vh",background:t.bg,display:"flex",flexDirection:"column",alignItems:"center",padding:"24px 14px 60px",transition:"background 0.3s"}}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{width:"100%",maxWidth:660,display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div>
          <h1 style={{fontSize:28,fontWeight:800,letterSpacing:-1,color:t.text}}>Link<span style={{color:t.green}}>Guard</span></h1>
          <p style={{color:t.muted,fontSize:11,marginTop:1}}>VirusTotal · 70+ engines · Mobile ready</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>{setBulkMode(b=>!b);setError(null);}} style={{padding:"7px 13px",borderRadius:10,border:`1px solid ${bulkMode?t.green:t.border}`,background:bulkMode?`${t.green}18`:t.surface,color:bulkMode?t.green:t.muted,fontFamily:"Syne",fontWeight:700,fontSize:12,cursor:"pointer"}}>Bulk</button>
          <button onClick={()=>setDark(d=>!d)} style={{width:38,height:38,borderRadius:10,border:`1px solid ${t.border}`,background:t.surface,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>{dark?"☀️":"🌙"}</button>
        </div>
      </div>

      {/* ── Main Card ──────────────────────────────────────────── */}
      <div style={{width:"100%",maxWidth:660,background:t.surface,border:`1px solid ${t.border}`,borderRadius:20,padding:"20px 16px",display:"flex",flexDirection:"column",gap:14,transition:"background 0.3s,border-color 0.3s"}}>

        {/* API Key */}
        <div>
          <label style={{fontSize:9,fontFamily:"Space Mono",color:t.muted,letterSpacing:1.2,display:"block",marginBottom:6,textTransform:"uppercase"}}>API Key</label>
          <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="VirusTotal API key (saved for session)"
            style={{width:"100%",padding:"11px 13px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.border}`,color:t.green,fontFamily:"Space Mono",fontSize:12,outline:"none"}}
            onFocus={e=>e.target.style.borderColor=t.green} onBlur={e=>e.target.style.borderColor=t.border}/>
          <p style={{fontSize:9,color:t.muted,marginTop:4,fontFamily:"Space Mono"}}>Free at virustotal.com → Sign up → Profile → API Key</p>
        </div>

        {/* Single scan or bulk toggle */}
        {!bulkMode?(
          <div>
            <label style={{fontSize:9,fontFamily:"Space Mono",color:t.muted,letterSpacing:1.2,display:"block",marginBottom:6,textTransform:"uppercase"}}>URL to Scan</label>
            <div className={dragOver?"dropzone-active":""} onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={onDrop}
              style={{display:"flex",gap:8,padding:dragOver?"8px":"0",borderRadius:12,border:`2px dashed ${dragOver?t.green:"transparent"}`,transition:"all 0.2s"}}>
              <input type="url" value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!loading&&doScan(url,apiKey)}
                placeholder="https://example.com  (or drag & drop a link)"
                style={{flex:1,padding:"11px 13px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.border}`,color:t.text,fontFamily:"Space Mono",fontSize:12,outline:"none"}}
                onFocus={e=>e.target.style.borderColor=t.green} onBlur={e=>e.target.style.borderColor=t.border}/>
              <button onClick={result?reset:()=>doScan(url,apiKey)} disabled={loading}
                style={{padding:"11px 18px",borderRadius:10,border:"none",background:loading||result?t.border:t.green,color:loading||result?t.muted:dark?"#0a0a0f":"#fff",fontFamily:"Syne",fontWeight:700,fontSize:13,cursor:loading?"not-allowed":"pointer",whiteSpace:"nowrap",transition:"all 0.2s",flexShrink:0}}>
                {loading?"…":result?"Reset":"Scan →"}
              </button>
            </div>
            <p style={{fontSize:9,color:t.muted,marginTop:4,fontFamily:"Space Mono"}}>Drag & drop a link here · Press Enter to scan</p>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <label style={{fontSize:9,fontFamily:"Space Mono",color:t.muted,letterSpacing:1.2,textTransform:"uppercase"}}>Bulk Scan — one URL per line</label>
            <textarea value={bulkText} onChange={e=>setBulkText(e.target.value)} placeholder={"https://example.com\nhttps://another-url.com\nhttps://third-url.com"}
              rows={4} style={{width:"100%",padding:"11px 13px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.border}`,color:t.text,fontFamily:"Space Mono",fontSize:11,outline:"none",resize:"vertical"}}
              onFocus={e=>e.target.style.borderColor=t.green} onBlur={e=>e.target.style.borderColor=t.border}/>
            <button onClick={runBulk} disabled={bulkRunning}
              style={{padding:"11px 18px",borderRadius:10,border:"none",background:bulkRunning?t.border:t.green,color:bulkRunning?t.muted:dark?"#0a0a0f":"#fff",fontFamily:"Syne",fontWeight:700,fontSize:13,cursor:bulkRunning?"not-allowed":"pointer",transition:"all 0.2s"}}>
              {bulkRunning?"Scanning… (rate limited)":"Scan All →"}
            </button>
            {bulkRunning&&<p style={{fontSize:9,color:t.muted,fontFamily:"Space Mono",textAlign:"center"}}>⏱ 15s delay between scans (free tier rate limit)</p>}
            {bulkResults.length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {bulkResults.map((item,i)=><BulkRow key={i} item={item} t={t}/>)}
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {loading&&(
          <div style={{padding:16,borderRadius:12,background:t.inputBg,border:`1px solid ${t.border}`,textAlign:"center"}}>
            <div style={{fontSize:12,fontFamily:"Space Mono",color:t.green,marginBottom:8}}>{phase==="submitting"?"⟳  Submitting to VirusTotal…":"⟳  Engines analyzing… (15–30s)"}</div>
            <div style={{height:3,borderRadius:99,background:t.border,overflow:"hidden",margin:"0 auto",maxWidth:220}}>
              <div style={{height:"100%",background:t.green,width:"40%",borderRadius:99,animation:"slide 1.4s ease-in-out infinite"}}/>
            </div>
          </div>
        )}

        {/* Error */}
        {error&&<div style={{padding:12,borderRadius:10,background:`${t.red}0d`,border:`1px solid ${t.red}33`,color:t.red,fontFamily:"Space Mono",fontSize:11}}>✕ {error}</div>}

        {/* Results */}
        {result&&(
          <div className="fadein" style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* URL + action row */}
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"9px 12px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.border}`,flexWrap:"wrap"}}>
              <span style={{fontFamily:"Space Mono",fontSize:10,color:t.code,flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",minWidth:100}}>{scannedUrl}</span>
              {[[copyMsg||"📋",handleCopy],[shareMsg||"🔗",handleShare],["🔁",()=>doScan(scannedUrl,apiKey)]].map(([lbl,fn],i)=>(
                <button key={i} onClick={fn} style={{fontSize:13,width:34,height:30,borderRadius:8,border:`1px solid ${t.border}`,background:t.surface,color:t.muted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=t.green} onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}
                  title={["Copy results","Share link","Re-scan"][i]}>{lbl}</button>
              ))}
            </div>

            {/* Tab bar — scrollable on mobile */}
            <div style={{display:"flex",gap:3,background:t.inputBg,borderRadius:12,padding:3,border:`1px solid ${t.border}`,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              {TABS.map(id=><TabBtn key={id} label={id} active={tab===id} onClick={()=>setTab(id)} t={t} dark={dark}/>)}
            </div>

            {/* ── Overview ──────────────────────────────────── */}
            {tab==="Overview"&&(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{display:"flex",gap:12,alignItems:"center",padding:16,borderRadius:14,background:`${rc}0d`,border:`1px solid ${rc}33`,flexWrap:"wrap"}}>
                  <RiskGauge score={risk.score} label={risk.label} colorKey={risk.color} t={t}/>
                  <div style={{flex:1,minWidth:160}}>
                    <div style={{fontSize:17,fontWeight:800,color:rc,letterSpacing:-0.5}}>{mal===0&&sus===0?"✓ No threats detected":`⚠ ${mal+sus} engine${mal+sus>1?"s":""} flagged`}</div>
                    <div style={{fontSize:11,color:t.muted,marginTop:5,fontFamily:"Space Mono"}}>{tot} engines · {lastAnalysisDate||"just now"}</div>
                    {result.categories&&Object.keys(result.categories).length>0&&<div style={{marginTop:8}}><CategoryTags categories={result.categories} t={t}/></div>}
                  </div>
                </div>
                <ThreatBar mal={mal} sus={sus} har={har} und={und} t={t}/>
              </div>
            )}

            {/* ── Intel ─────────────────────────────────────── */}
            {tab==="Intel"&&(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <InfoRow icon="🌐" label="Final URL" value={result.url||scannedUrl} t={t}/>
                {result.tld&&<InfoRow icon="📌" label="TLD" value={result.tld} t={t}/>}
                {result.last_http_response_code&&<InfoRow icon="📡" label="HTTP Status" value={`${result.last_http_response_code}`} color={result.last_http_response_code===200?t.green:t.yellow} t={t}/>}
                {result.last_http_response_content_type&&<InfoRow icon="📄" label="Content Type" value={result.last_http_response_content_type} t={t}/>}
                {result.last_http_response_content_length&&<InfoRow icon="📦" label="Response Size" value={`${(result.last_http_response_content_length/1024).toFixed(1)} KB`} t={t}/>}
                {redirects.length>0&&(
                  <div style={{padding:"12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.yellow}44`}}>
                    <div style={{fontSize:9,fontFamily:"Space Mono",color:t.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>🔀 Redirect Chain ({redirects.length} hops)</div>
                    {redirects.map((r,i)=>(
                      <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:i<redirects.length-1?6:0}}>
                        <span style={{fontFamily:"Space Mono",fontSize:9,color:t.muted,flexShrink:0,paddingTop:1}}>#{i+1}</span>
                        <span style={{fontFamily:"Space Mono",fontSize:10,color:i===redirects.length-1?t.green:t.yellow,wordBreak:"break-all"}}>{r}</span>
                      </div>
                    ))}
                  </div>
                )}
                {redirects.length===0&&<InfoRow icon="✅" label="Redirects" value="No redirects detected" color={t.green} t={t}/>}
                <SSLCard ssl={ssl} t={t}/>
              </div>
            )}

            {/* ── Charts ────────────────────────────────────── */}
            {tab==="Charts"&&(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{display:"flex",gap:12,alignItems:"center",justifyContent:"center",padding:16,borderRadius:14,background:t.inputBg,border:`1px solid ${t.border}`,flexWrap:"wrap"}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                    <span style={{fontSize:9,fontFamily:"Space Mono",color:t.muted,letterSpacing:1,textTransform:"uppercase"}}>Distribution</span>
                    <DonutChart mal={mal} sus={sus} har={har} und={und} t={t}/>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                    <span style={{fontSize:9,fontFamily:"Space Mono",color:t.muted,letterSpacing:1,textTransform:"uppercase"}}>Profile</span>
                    <RadarChart mal={mal} sus={sus} har={har} und={und} t={t}/>
                  </div>
                </div>
                {/* Stats grid */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[["🔴 Malicious",mal,t.red],["🟡 Suspicious",sus,t.yellow],["✅ Harmless",har,t.green],["⚪ Undetected",und,t.muted]].map(([lbl,val,color],i)=>(
                    <div key={i} style={{padding:"12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${color}33`,display:"flex",flexDirection:"column",gap:4}}>
                      <span style={{fontSize:22,fontWeight:800,fontFamily:"Space Mono",color}}>{val}</span>
                      <span style={{fontSize:10,color:t.muted,fontFamily:"Space Mono"}}>{lbl}</span>
                      <div style={{height:3,borderRadius:99,background:t.border,marginTop:4}}>
                        <div style={{height:"100%",background:color,borderRadius:99,width:`${tot?Math.round(val/tot*100):0}%`,transition:"width 0.6s"}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Engines ───────────────────────────────────── */}
            {tab==="Engines"&&(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {flagged.length>0&&(
                  <div>
                    <div style={{fontSize:9,fontFamily:"Space Mono",color:t.muted,letterSpacing:1,marginBottom:6,textTransform:"uppercase"}}>Flagged ({flagged.length})</div>
                    <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:260,overflowY:"auto"}}>
                      {flagged.map(([name,data])=>(
                        <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 11px",borderRadius:9,background:data.category==="malicious"?`${t.red}0a`:`${t.yellow}0a`,border:`1px solid ${data.category==="malicious"?t.red:t.yellow}33`}}>
                          <span style={{fontFamily:"Space Mono",fontSize:11,color:t.muted}}>{name}</span>
                          <span style={{fontSize:10,fontFamily:"Space Mono",color:data.category==="malicious"?t.red:t.yellow,textAlign:"right",marginLeft:8}}>{data.result||data.category}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {flagged.length===0&&<div style={{textAlign:"center",padding:18,fontFamily:"Space Mono",fontSize:12,color:t.green}}>✓ Zero engines flagged this URL</div>}
                {clean.length>0&&(
                  <details>
                    <summary style={{fontSize:9,fontFamily:"Space Mono",color:t.muted,letterSpacing:1,textTransform:"uppercase",userSelect:"none",padding:"4px 0"}}>Clean Engines ({clean.length}) ▾</summary>
                    <div style={{display:"flex",flexDirection:"column",gap:3,marginTop:6,maxHeight:240,overflowY:"auto"}}>
                      {clean.map(([name])=>(
                        <div key={name} style={{display:"flex",justifyContent:"space-between",padding:"6px 11px",borderRadius:8,background:t.inputBg,border:`1px solid ${t.border}`}}>
                          <span style={{fontFamily:"Space Mono",fontSize:10,color:t.muted}}>{name}</span>
                          <span style={{fontSize:10,fontFamily:"Space Mono",color:t.green}}>○ clean</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* ── SSL tab ───────────────────────────────────── */}
            {tab==="SSL"&&(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{fontSize:9,fontFamily:"Space Mono",color:t.muted,letterSpacing:1,textTransform:"uppercase"}}>SSL / TLS Certificate</div>
                <SSLCard ssl={ssl} t={t}/>
              </div>
            )}

            {/* ── History tab ───────────────────────────────── */}
            {tab==="History"&&(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:9,fontFamily:"Space Mono",color:t.muted,letterSpacing:1,textTransform:"uppercase"}}>Session History ({history.length})</div>
                  {history.length>0&&<button onClick={()=>setHistory([])} style={{fontSize:10,fontFamily:"Space Mono",color:t.red,background:"none",border:"none",cursor:"pointer"}}>Clear</button>}
                </div>
                {history.length===0?<div style={{fontSize:11,fontFamily:"Space Mono",color:t.muted,padding:14,textAlign:"center"}}>No scans yet</div>
                  :history.map((item,i)=><HistoryItem key={i} item={item} onReload={item=>{setUrl(item.url);setResult(item.result);setScannedUrl(item.url);setTab("Overview");}} t={t}/>)}
              </div>
            )}

            {/* ── Community tab ─────────────────────────────── */}
            {tab==="Community"&&(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:9,fontFamily:"Space Mono",color:t.muted,letterSpacing:1,textTransform:"uppercase"}}>🌍 Community Scan Feed</div>
                  <button onClick={loadFeed} style={{fontSize:10,fontFamily:"Space Mono",color:t.blue,background:"none",border:"none",cursor:"pointer"}}>Refresh</button>
                </div>
                <p style={{fontSize:9,color:t.muted,fontFamily:"Space Mono"}}>URLs scanned by all LinkGuard users (shared publicly)</p>
                {feedLoading?<div style={{textAlign:"center",padding:14,fontFamily:"Space Mono",fontSize:11,color:t.muted}}>Loading…</div>
                  :communityFeed.length===0?<div style={{textAlign:"center",padding:14,fontFamily:"Space Mono",fontSize:11,color:t.muted}}>No community scans yet. Be the first!</div>
                  :communityFeed.map((item,i)=><FeedItem key={i} item={item} t={t}/>)}
              </div>
            )}

          </div>
        )}

        {/* ── No result yet: show History + Community preview ── */}
        {!result&&!loading&&(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",gap:3,background:t.inputBg,borderRadius:12,padding:3,border:`1px solid ${t.border}`}}>
              {TABS.map(id=><TabBtn key={id} label={id} active={tab===id} onClick={()=>{setTab(id);if(id==="Community")loadFeed();}} t={t} dark={dark}/>)}
            </div>
            {tab==="History"&&(
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {history.length===0?<div style={{fontSize:11,fontFamily:"Space Mono",color:t.muted,padding:14,textAlign:"center"}}>No scans yet</div>
                  :history.map((item,i)=><HistoryItem key={i} item={item} onReload={item=>{setUrl(item.url);setResult(item.result);setScannedUrl(item.url);}} t={t}/>)}
              </div>
            )}
            {tab==="Community"&&(
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <p style={{fontSize:9,color:t.muted,fontFamily:"Space Mono"}}>🌍 URLs scanned by all LinkGuard users (public)</p>
                {feedLoading?<div style={{textAlign:"center",padding:14,fontFamily:"Space Mono",fontSize:11,color:t.muted}}>Loading…</div>
                  :communityFeed.length===0?<div style={{textAlign:"center",padding:14,fontFamily:"Space Mono",fontSize:11,color:t.muted}}>No community scans yet. Be the first!</div>
                  :communityFeed.map((item,i)=><FeedItem key={i} item={item} t={t}/>)}
              </div>
            )}
          </div>
        )}

      </div>
      <p style={{marginTop:16,fontSize:9,fontFamily:"Space Mono",color:t.muted,textAlign:"center"}}>Free tier: 500 req/day · 4 req/min · Non-commercial use</p>
    </div>
  </>);
}
