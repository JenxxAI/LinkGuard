import { useState, useRef, useCallback, useEffect } from "react";

const DARK={bg:"#0a0a0f",surface:"#111118",border:"#1e1e2e",text:"#e8e6f0",muted:"#5a5a7a",code:"#a0a0c8",green:"#00ff9d",red:"#ff3c5c",yellow:"#ffe566",blue:"#5b8cff",inputBg:"#0d0d14",cardBg:"#13131f"};
const LIGHT={bg:"#f0f0f5",surface:"#ffffff",border:"#e0dfe8",text:"#1a1a2e",muted:"#8888aa",code:"#444466",green:"#00a86b",red:"#e8294a",yellow:"#c47d00",blue:"#2f5fd4",inputBg:"#f8f8fc",cardBg:"#f4f4fa"};
const FONTS=`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Plus+Jakarta+Sans:wght@400;600;800&display=swap');`;

function getRisk(m,s,tot){
  if(!tot)return{score:0,label:"Unknown",color:null};
  const p=Math.round(((m+s*0.5)/tot)*100);
  if(!m&&!s)return{score:0,label:"Clean",color:"green"};
  if(!m&&s<=2)return{score:p,label:"Low Risk",color:"yellow"};
  if(m<=4)return{score:p,label:"Medium Risk",color:"yellow"};
  if(m<=10)return{score:p,label:"High Risk",color:"red"};
  return{score:p,label:"Dangerous",color:"red"};
}
function shortUrl(u){try{const x=new URL(u);return x.hostname+(x.pathname.length>1?x.pathname.slice(0,20)+(x.pathname.length>20?"…":""):"");}catch{return u.slice(0,35)+(u.length>35?"…":"");}}const SHORT_DOMAINS=new Set(['bit.ly','t.co','tinyurl.com','ow.ly','rb.gy','is.gd','cutt.ly','buff.ly','short.io','shorturl.at','tiny.cc','lnkd.in']);
function isShortUrl(u){try{return SHORT_DOMAINS.has(new URL(u).hostname);}catch{return false;}}
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
          style={{fontFamily:"JetBrains Mono",fontSize:8,fontWeight:700}}>{labels[i]}</text>
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
      <text x={cx} y={cy-5} textAnchor="middle" fill={t.text} style={{fontFamily:"JetBrains Mono",fontSize:11,fontWeight:700}}>{tot}</text>
      <text x={cx} y={cy+8} textAnchor="middle" fill={t.muted} style={{fontFamily:"JetBrains Mono",fontSize:7}}>engines</text>
    </svg>
  );
}

// ── Gauge (animated counter) ─────────────────────────────────────────
function RiskGauge({score,label,colorKey,t}){
  const [disp,setDisp]=useState(0);
  useEffect(()=>{
    if(!score){setDisp(0);return;}
    let start=null;const dur=900;
    const step=ts=>{if(!start)start=ts;const p=Math.min((ts-start)/dur,1);setDisp(Math.round(p*score));if(p<1)requestAnimationFrame(step);};
    const raf=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf);
  },[score]);
  const angle=-135+(disp/100)*270,color=t[colorKey]||t.muted;
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <svg viewBox="0 0 120 80" width="100" height="67">
        <path d="M10 70 A50 50 0 0 1 110 70" fill="none" stroke={t.border} strokeWidth="10" strokeLinecap="round"/>
        <path d="M10 70 A50 50 0 0 1 110 70" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray="157" strokeDashoffset={157-(disp/100)*157}/>
        <line x1="60" y1="70" x2="60" y2="28" stroke={color} strokeWidth="3" strokeLinecap="round"
          style={{transformOrigin:"60px 70px",transform:`rotate(${angle}deg)`}}/>
        <circle cx="60" cy="70" r="5" fill={color}/>
        <text x="60" y="60" textAnchor="middle" fill={t.text} style={{fontFamily:"JetBrains Mono",fontSize:15,fontWeight:700}}>{disp}</text>
      </svg>
      <span style={{fontFamily:"JetBrains Mono",fontSize:10,fontWeight:700,color,letterSpacing:1}}>{label.toUpperCase()}</span>
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
            <span style={{fontSize:10,fontFamily:"JetBrains Mono",color:t.muted}}>{s.l} <span style={{color:t.text}}>{s.v}</span><span style={{opacity:0.5}}> {Math.round(s.v/tot*100)}%</span></span>
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
        return<span key={i} style={{padding:"2px 9px",borderRadius:99,fontSize:10,fontFamily:"JetBrains Mono",fontWeight:700,background:isBad?`${t.red}18`:`${t.green}18`,color:isBad?t.red:t.green,border:`1px solid ${isBad?t.red:t.green}33`,textTransform:"uppercase",letterSpacing:0.5}}>{cat}</span>;
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
        <span style={{fontFamily:"JetBrains Mono",fontSize:11,fontWeight:700,color:valid===false?t.red:t.green}}>{valid===false?"EXPIRED SSL":valid?"VALID SSL":"SSL INFO"}</span>
      </div>
      {[["Issuer",ssl.cert_issuer],["Subject",ssl.cert_subject],["Expires",exp],["Serial",ssl.cert_serial_number]].filter(([,v])=>v&&v!=="N/A").map(([k,v])=>(
        <div key={k} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
          <span style={{fontFamily:"JetBrains Mono",fontSize:9,color:t.muted,minWidth:52,textTransform:"uppercase",letterSpacing:0.5,paddingTop:1}}>{k}</span>
          <span style={{fontFamily:"JetBrains Mono",fontSize:10,color:t.code,wordBreak:"break-all"}}>{v}</span>
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
        <div style={{fontSize:9,fontFamily:"JetBrains Mono",color:t.muted,textTransform:"uppercase",letterSpacing:0.8,marginBottom:2}}>{label}</div>
        <div style={{fontSize:11,fontFamily:mono?"JetBrains Mono":"Plus Jakarta Sans",color:color||t.text,wordBreak:"break-all"}}>{value||"—"}</div>
      </div>
    </div>
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
        <div style={{fontFamily:"JetBrains Mono",fontSize:10,color:t.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{shortUrl(item.url)}</div>
        {item.result&&<div style={{fontSize:9,color:t.muted,marginTop:1}}>{item.result.malicious+item.result.suspicious}/{item.result.total} engines flagged</div>}
      </div>
      <span style={{fontSize:10,fontFamily:"JetBrains Mono",color,flexShrink:0,textAlign:"right"}}>{risk.label}</span>
    </div>
  );
}



// ═══════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════
export default function App(){
  const [dark,setDark]=useState(true);
  const t=dark?DARK:LIGHT;
  const [url,setUrl]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);
  const [result,setResult]=useState(null);
  const [scannedUrl,setScannedUrl]=useState("");
  const [phase,setPhase]=useState(null);
  const [tab,setTab]=useState("Overview");
  const [shareMsg,setShareMsg]=useState(null);
  const [copyMsg,setCopyMsg]=useState(null);
  const [bulkMode,setBulkMode]=useState(false);
  const [bulkText,setBulkText]=useState("");
  const [bulkResults,setBulkResults]=useState([]);
  const [bulkRunning,setBulkRunning]=useState(false);
  const [dragOver,setDragOver]=useState(false);
  const pollRef=useRef(null);
  const bulkCancelRef=useRef(false);
  const touchStartX=useRef(null);
  const [history,setHistory]=useState(()=>{try{return JSON.parse(localStorage.getItem('lg_history')||'[]');}catch{return[];}});
  const [expanded,setExpanded]=useState(null);
  const [expandLoading,setExpandLoading]=useState(false);
  const [copiedEngine,setCopiedEngine]=useState(null);
  const [showLegend,setShowLegend]=useState(false);
  const qrInputRef=useRef(null);

  // ── expand short URLs ────────────────────────────────────────────────
  useEffect(()=>{
    if(!url||!isShortUrl(url)){setExpanded(null);setExpandLoading(false);return;}
    const ctrl=new AbortController();
    setExpandLoading(true);setExpanded(null);
    fetch(`/api/expand?url=${encodeURIComponent(url)}`,{signal:ctrl.signal})
      .then(r=>r.json())
      .then(d=>{if(d.resolved&&d.resolved!==url)setExpanded(d.resolved);setExpandLoading(false);})
      .catch(()=>setExpandLoading(false));
    return()=>ctrl.abort();
  },[url]);

  // ── QR scanner ───────────────────────────────────────────────────────
  const handleQR=()=>qrInputRef.current?.click();
  const onQRFile=async e=>{
    const file=e.target.files?.[0];if(!file)return;e.target.value='';
    try{
      const bd=new window.BarcodeDetector({formats:['qr_code']});
      const bmp=await createImageBitmap(file);
      const codes=await bd.detect(bmp);
      const found=codes.find(c=>c.rawValue?.startsWith('http'))?.rawValue;
      if(found){setUrl(found);setTimeout(()=>doScan(found),50);}
      else setError('No URL found in QR code.');
    }catch{setError('QR scanning is not supported in this browser.');}
  };

  // ── single scan ──────────────────────────────────────────────────────
  const doScan=useCallback(async(su,silent=false)=>{
    if(!su?.trim()){if(!silent)setError("Enter a URL to scan.");return null;}
    try{new URL(su.trim());}catch{if(!silent)setError("Enter a valid URL (must start with http:// or https://)");return null;}
    if(!silent){setError(null);setResult(null);setLoading(true);setPhase("submitting");setScannedUrl(su.trim());setTab("Overview");}
    try{
      const fd=new URLSearchParams();fd.append("url",su.trim());
      const r=await fetch("/api/urls",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:fd.toString()});
      if(!r.ok){
        let msg=`HTTP ${r.status}`;
        try{const e=await r.json();msg=e?.error?.message||msg;}catch{}
        if(r.status===429)msg="Daily quota reached — VirusTotal free tier allows 500 requests/day. Try again tomorrow.";
        throw new Error(msg);
      }
      let submitData;try{submitData=await r.json();}catch{throw new Error("Invalid response from server.");}
      const id=submitData.data?.id;
      if(!id)throw new Error("No analysis ID.");
      if(!silent)setPhase("polling");
      let attempts=0;
      return await new Promise((resolve,reject)=>{
        const poll=async()=>{
          if(++attempts>24){reject(new Error("Timed out"));return;}
          const pr=await fetch(`/api/analyses/${id}`);
          let pd;try{pd=await pr.json();}catch{pollRef.current=setTimeout(poll,3000);return;}
          if(pd.data?.attributes?.status==="completed"){
            const attrs=pd.data.attributes;
            if(!silent){setResult(attrs);setPhase("done");setLoading(false);navigator.vibrate?.(100);}
            const s=attrs?.stats||{},m=s.malicious||0,ss=s.suspicious||0,h=s.harmless||0,u=s.undetected||0,tot=m+ss+h+u+(s.timeout||0);
            const rk=getRisk(m,ss,tot);
            setHistory(prev=>{const entry={url:su.trim(),label:rk.label,color:rk.color,score:rk.score,date:Date.now()};const next=[entry,...prev.filter(x=>x.url!==su.trim())].slice(0,20);localStorage.setItem('lg_history',JSON.stringify(next));return next;});
            if(!silent)document.title=`${m>0||ss>0?'⚠':'✓'} ${rk.label} — LinkGuard`;
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
    bulkCancelRef.current=false;
    setError(null);setBulkResults(urls.map(u=>({url:u,status:"queued",result:null})));setBulkRunning(true);
    for(let i=0;i<urls.length;i++){
      if(bulkCancelRef.current)break;
      setBulkResults(prev=>prev.map((x,j)=>j===i?{...x,status:"scanning"}:x));
      if(i>0){await new Promise(res=>{let e=0;const tk=setInterval(()=>{e+=300;if(e>=15500||bulkCancelRef.current){clearInterval(tk);res();}},300);});}
      if(bulkCancelRef.current)break;
      try{
        const res=await doScan(urls[i],true);
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
  const handleShare=async()=>{const link=`${window.location.href.split("#")[0]}#${btoa(JSON.stringify({u:scannedUrl}))}`;if(navigator.share){try{await navigator.share({title:`LinkGuard — ${shortUrl(scannedUrl)}`,url:link});}catch(e){if(e?.name!=="AbortError"){navigator.clipboard.writeText(link);setShareMsg("Copied!");setTimeout(()=>setShareMsg(null),2000);}}}else{try{navigator.clipboard.writeText(link);setShareMsg("Copied!");setTimeout(()=>setShareMsg(null),2000);}catch{setShareMsg("Error");}}};
  const handleCopy=()=>{if(!result)return;const s=result.stats||{},m=s.malicious||0,ss=s.suspicious||0,tot=m+ss+(s.harmless||0)+(s.undetected||0),risk=getRisk(m,ss,tot);navigator.clipboard.writeText(`🔍 LinkGuard Scan\n🔗 ${scannedUrl}\n⚠️ Risk: ${risk.label} (${risk.score}/100)\n🔴 Malicious: ${m}  🟡 Suspicious: ${ss}  ✅ Harmless: ${s.harmless||0}\n📊 ${tot} engines checked`);setCopyMsg("Copied!");setTimeout(()=>setCopyMsg(null),2000);};
  const handleExport=()=>{if(!result)return;const report={url:scannedUrl,scannedAt:result.date?new Date(result.date*1000).toISOString():new Date().toISOString(),risk:{label:risk.label,score:risk.score},stats:{malicious:mal,suspicious:sus,harmless:har,undetected:und,total:tot},flaggedEngines:flagged.map(([name,data])=>({name,category:data.category,result:data.result||null})),categories:result.categories||{},redirectChain:redirects,ssl:ssl?{issuer:ssl.cert_issuer,subject:ssl.cert_subject,expires:ssl.cert_validity_date?new Date(ssl.cert_validity_date*1000).toLocaleDateString():null}:null};const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`linkguard-${shortUrl(scannedUrl).replace(/[^a-z0-9]/gi,'-')}.json`;a.click();URL.revokeObjectURL(a.href);};

  const reset=()=>{clearTimeout(pollRef.current);setResult(null);setError(null);setLoading(false);setPhase(null);setUrl("");setScannedUrl("");setExpanded(null);document.title="LinkGuard";};

  // ── derived state ────────────────────────────────────────────────────
  const s=result?.stats||{},mal=s.malicious||0,sus=s.suspicious||0,har=s.harmless||0,und=s.undetected||0,tot=mal+sus+har+und+(s.timeout||0);
  const risk=getRisk(mal,sus,tot),rc=t[risk.color]||t.muted;
  const engines=result?.results?Object.entries(result.results):[];
  const flagged=engines.filter(([,v])=>v.category==="malicious"||v.category==="suspicious");
  const clean=engines.filter(([,v])=>v.category==="harmless"||v.category==="undetected");
  const ssl=result?.last_https_certificate;
  const redirects=result?.redirection_chain||[];
  const lastAnalysisDate=result?.date?new Date(result.date*1000).toLocaleString():null;
  const scanAgeDays=result?.date?Math.floor((Date.now()-result.date*1000)/86400000):0;
  const isStale=scanAgeDays>=7;

  // ── keyboard shortcut (Cmd/Ctrl + Enter) ────────────────────────────
  useEffect(()=>{
    const h=e=>{
      if((e.metaKey||e.ctrlKey)&&e.key==='Enter'&&!loading&&!bulkMode){
        if(result)reset();else if(url)doScan(url);
      }
    };
    window.addEventListener('keydown',h);
    return()=>window.removeEventListener('keydown',h);
  },[loading,bulkMode,result,url,doScan]);

  const TABS=["Overview","Intel","Charts","Engines","SSL"];

  // ── render ───────────────────────────────────────────────────────────
  return(<>
    <style>{FONTS+`
      *{box-sizing:border-box;margin:0;padding:0;}
      html{height:-webkit-fill-available;}
      body{background:${t.bg};color:${t.text};font-family:'Plus Jakarta Sans',sans-serif;transition:background 0.3s,color 0.3s;-webkit-tap-highlight-color:transparent;min-height:100vh;min-height:-webkit-fill-available;overscroll-behavior:none;}
      button,a{touch-action:manipulation;}
      details summary{list-style:none;cursor:pointer;}
      details summary::-webkit-details-marker{display:none;}
      ::-webkit-scrollbar{width:4px;}
      ::-webkit-scrollbar-thumb{background:${t.border};border-radius:99px;}
      input,textarea{transition:border-color 0.2s;-webkit-appearance:none;font-size:16px;}
      input::placeholder,textarea::placeholder{color:${t.muted};}
      @keyframes slide{0%{margin-left:-40%}100%{margin-left:100%}}
      @keyframes fadein{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
      .fadein{animation:fadein 0.35s ease both;}
      .dropzone-active{border-color:${t.green}!important;background:${t.green}0a!important;}
      .card{width:100%;background:${t.surface};border:1px solid ${t.border};border-radius:clamp(14px,3vw,22px);padding:clamp(14px,4vw,24px);display:flex;flex-direction:column;gap:clamp(10px,3vw,16px);transition:background 0.3s,border-color 0.3s;}
      .scan-row{display:flex;gap:clamp(6px,2vw,10px);}
      .url-input{flex:1;min-width:0;padding:clamp(11px,2.5vw,14px) clamp(12px,3vw,16px);border-radius:10px;font-family:'JetBrains Mono',monospace;font-size:16px;outline:none;width:100%;}
      .scan-btn{flex-shrink:0;padding:clamp(11px,2.5vw,14px) clamp(16px,4vw,22px);border-radius:10px;border:none;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:clamp(13px,3.5vw,14px);cursor:pointer;white-space:nowrap;transition:all 0.2s;min-height:44px;}
      .tab-bar{display:flex;gap:3px;border-radius:12px;padding:3px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
      .tab-bar::-webkit-scrollbar{display:none;}
      .tab-btn{flex:1;min-width:fit-content;padding:clamp(7px,2vw,9px) clamp(6px,2vw,10px);border-radius:9px;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:clamp(11px,3vw,13px);transition:all 0.2s;white-space:nowrap;}
      .action-btn{font-size:clamp(13px,3.5vw,15px);width:clamp(34px,9vw,38px);height:clamp(34px,9vw,38px);border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:border-color 0.2s;}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(6px,2vw,10px);}
      @media(max-width:420px){
        .scan-row{flex-direction:column;}
        .scan-btn{width:100%;padding:15px;border-radius:12px;}
        .info-grid{grid-template-columns:1fr;}
      }
    `}</style>

    <div style={{minHeight:"100vh",background:t.bg,display:"flex",flexDirection:"column",alignItems:"center",
      paddingTop:"max(clamp(14px,4vw,28px),env(safe-area-inset-top))",
      paddingBottom:"max(80px,calc(60px + env(safe-area-inset-bottom)))",
      paddingLeft:"max(clamp(10px,4vw,20px),env(safe-area-inset-left))",
      paddingRight:"max(clamp(10px,4vw,20px),env(safe-area-inset-right))",
      transition:"background 0.3s"}}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{width:"100%",maxWidth:680,display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"clamp(14px,4vw,22px)"}}>
        <div>
          <h1 style={{fontSize:"clamp(22px,6vw,30px)",fontWeight:800,letterSpacing:-1,color:t.text}}>Link<span style={{color:t.green}}>Guard</span></h1>
          <p style={{color:t.muted,fontSize:"clamp(10px,2.5vw,12px)",marginTop:2}}>70+ security engines · Instant scan</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>{setBulkMode(b=>!b);setError(null);}} style={{padding:"9px 14px",borderRadius:10,border:`1px solid ${bulkMode?t.green:t.border}`,background:bulkMode?`${t.green}18`:t.surface,color:bulkMode?t.green:t.muted,fontFamily:"Plus Jakarta Sans",fontWeight:700,fontSize:13,cursor:"pointer",minHeight:38}}>Bulk</button>
          <button onClick={()=>setDark(d=>!d)} style={{width:38,height:38,borderRadius:10,border:`1px solid ${t.border}`,background:t.surface,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}} title={dark?"Switch to light mode":"Switch to dark mode"}>
            {dark?(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ):(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Main Card ──────────────────────────────────────────── */}
      <div className="card" style={{maxWidth:680}}>

        {/* API Key section removed — key is stored in .env on the server */}

        {/* Single scan or bulk toggle */}
        {!bulkMode?(
          <div>
            <label style={{fontSize:9,fontFamily:"JetBrains Mono",color:t.muted,letterSpacing:1.2,display:"block",marginBottom:6,textTransform:"uppercase"}}>URL to Scan</label>
            <div className={`scan-row${dragOver?" dropzone-active":""}`} onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={onDrop}
              style={{padding:dragOver?"8px":"0",borderRadius:12,border:`2px dashed ${dragOver?t.green:"transparent"}`,transition:"all 0.2s"}}>
              <input type="url" inputMode="url" value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!loading&&doScan(url)}
                onPaste={e=>{const text=e.clipboardData.getData('text').trim();if(text.startsWith('http')&&!loading)setTimeout(()=>doScan(text),50);}}
                placeholder="https://example.com"
                className="url-input"
                style={{background:t.inputBg,border:`1px solid ${t.border}`,color:t.text}}
                onFocus={e=>e.target.style.borderColor=t.green} onBlur={e=>e.target.style.borderColor=t.border}/>
              <button onClick={result?reset:()=>doScan(url)} disabled={loading}
                className="scan-btn"
                style={{background:loading||result?t.border:t.green,color:loading||result?t.muted:dark?"#0a0a0f":"#fff",cursor:loading?"not-allowed":"pointer"}}>
                {loading?"…":result?"Reset":"Scan →"}
              </button>
            </div>
            {'BarcodeDetector' in window&&(
              <button onClick={handleQR} title="Scan a QR code image"
                style={{marginTop:6,width:"100%",padding:"9px",borderRadius:10,border:`1px solid ${t.border}`,background:t.surface,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                  <rect x="7" y="7" width="3" height="3" rx="0.5"/><rect x="14" y="7" width="3" height="3" rx="0.5"/><rect x="14" y="14" width="3" height="3" rx="0.5"/><rect x="7" y="14" width="3" height="3" rx="0.5"/>
                </svg>
                <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:12,color:t.muted}}>Scan QR Code</span>
              </button>
            )}
            <input ref={qrInputRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={onQRFile}/>
            {(expandLoading||expanded)&&(
              <div style={{marginTop:6,padding:"6px 10px",borderRadius:8,background:t.inputBg,border:`1px solid ${t.border}`,fontSize:10,fontFamily:"JetBrains Mono",display:"flex",alignItems:"flex-start",gap:6}}>
                {expandLoading
                  ?<span style={{color:t.muted}}>↗ Resolving short URL…</span>
                  :<><span style={{color:t.muted,flexShrink:0}}>Resolves to:</span><span style={{color:t.green,wordBreak:"break-all"}}>{expanded}</span></>}
              </div>
            )}
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <label style={{fontSize:9,fontFamily:"JetBrains Mono",color:t.muted,letterSpacing:1.2,textTransform:"uppercase"}}>Bulk Scan — one URL per line</label>
            <textarea value={bulkText} onChange={e=>setBulkText(e.target.value)} placeholder={"https://example.com\nhttps://another-url.com\nhttps://third-url.com"}
              rows={4} style={{width:"100%",padding:"11px 13px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.border}`,color:t.text,fontFamily:"JetBrains Mono",fontSize:11,outline:"none",resize:"vertical"}}
              onFocus={e=>e.target.style.borderColor=t.green} onBlur={e=>e.target.style.borderColor=t.border}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={runBulk} disabled={bulkRunning}
                style={{flex:1,padding:"11px 18px",borderRadius:10,border:"none",background:bulkRunning?t.border:t.green,color:bulkRunning?t.muted:dark?"#0a0a0f":"#fff",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:13,cursor:bulkRunning?"not-allowed":"pointer",transition:"all 0.2s"}}>
                {bulkRunning?"Scanning… (rate limited)":"Scan All →"}
              </button>
              {bulkRunning&&<button onClick={()=>{bulkCancelRef.current=true;}}
                style={{padding:"11px 18px",borderRadius:10,border:`1px solid ${t.red}`,background:`${t.red}11`,color:t.red,fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",transition:"all 0.2s",flexShrink:0}}>
                Stop
              </button>}
            </div>
            {bulkRunning&&<p style={{fontSize:9,color:t.muted,fontFamily:"JetBrains Mono",textAlign:"center"}}>⏱ 15s delay between scans · tap Stop to cancel</p>}
            {bulkResults.length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {bulkResults.map((item,i)=><BulkRow key={i} item={item} t={t}/>)}
              </div>
            )}
          </div>
        )}

        {/* About / Guide */}
        {!loading&&!result&&!bulkMode&&(
          <details style={{marginTop:4}}>
            <summary style={{fontSize:9,fontFamily:"JetBrains Mono",color:t.muted,letterSpacing:1,textTransform:"uppercase",userSelect:"none",padding:"2px 0",cursor:"pointer"}}>
              About &amp; How to Use ▾
            </summary>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:12,padding:"14px 16px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.border}`}}>
              <div>
                <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:13,color:t.text,marginBottom:4}}>What is LinkGuard?</p>
                <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:t.muted,lineHeight:1.6}}>LinkGuard is a free URL safety scanner powered by <strong style={{color:t.text}}>70+ security engines</strong>. Paste any link before clicking it — LinkGuard checks it for malware, phishing, scams, and suspicious redirects in seconds.</p>
              </div>
              <div style={{width:"100%",height:1,background:t.border}}/>
              <div>
                <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:13,color:t.text,marginBottom:8}}>📖 How to use</p>
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  {[["🔗","Paste or type a URL","Drop any link into the input. Pasting auto-starts the scan."],["🔍","Hit Scan","Results arrive in 15–30 seconds as 70+ engines analyse the link."],["📊","Read the result","Overview shows your risk score. Swipe or tap tabs for details: Intel, Charts, Engines, SSL."],["📷","QR codes","Tap \u2018Scan QR Code\u2019 to decode a QR image directly from your camera or photo library."],["📃","Bulk scan","Toggle Bulk mode to paste multiple URLs at once — useful for checking several links quickly."],["⬇","Export","Download a full JSON report of any scan result for sharing or record-keeping."]].map(([icon,title,desc])=>(
                    <div key={title} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                      <span style={{fontSize:14,flexShrink:0,marginTop:1}}>{icon}</span>
                      <div><span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:12,color:t.text}}>{title} — </span><span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:12,color:t.muted}}>{desc}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{width:"100%",height:1,background:t.border}}/>
              <div style={{display:"flex",gap:8,padding:"8px 10px",borderRadius:9,background:`${t.yellow}0d`,border:`1px solid ${t.yellow}33`}}>
                <span style={{fontSize:13,flexShrink:0}}>⚠️</span>
                <p style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:t.muted,lineHeight:1.6}}>LinkGuard uses the <strong style={{color:t.text}}>VirusTotal free tier</strong> — limited to 500 scans/day and 4/minute. Results reflect the last cached analysis; click Re-scan if the data is stale.</p>
              </div>
            </div>
          </details>
        )}

        {/* Scan history */}
        {!loading&&!result&&!bulkMode&&history.length>0&&(
          <details>
            <summary style={{fontSize:9,fontFamily:"JetBrains Mono",color:t.muted,letterSpacing:1,textTransform:"uppercase",userSelect:"none",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"2px 0"}}>
              <span>Recent ({history.length})</span>
              <span style={{color:t.red,padding:"2px 6px",cursor:"pointer"}} onClick={e=>{e.preventDefault();setHistory([]);localStorage.removeItem('lg_history');}}>Clear</span>
            </summary>
            <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:8,maxHeight:200,overflowY:"auto"}}>
              {history.map((item,i)=>{
                const c=t[item.color]||t.muted;
                return(
                  <button key={i} onClick={()=>{setUrl(item.url);doScan(item.url);}}
                    style={{display:"flex",alignItems:"center",gap:8,padding:"8px 11px",borderRadius:9,background:t.inputBg,border:`1px solid ${t.border}`,cursor:"pointer",textAlign:"left",width:"100%",transition:"border-color 0.2s"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=t.green}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:c,flexShrink:0}}/>
                    <span style={{flex:1,fontFamily:"JetBrains Mono",fontSize:10,color:t.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{shortUrl(item.url)}</span>
                    <span style={{fontSize:9,fontFamily:"JetBrains Mono",color:c,flexShrink:0}}>{item.label}</span>
                    <span style={{fontSize:9,fontFamily:"JetBrains Mono",color:t.muted,flexShrink:0}}>{new Date(item.date).toLocaleDateString()}</span>
                  </button>
                );
              })}
            </div>
          </details>
        )}

        {/* Loading */}
        {loading&&(
          <div style={{padding:16,borderRadius:12,background:t.inputBg,border:`1px solid ${t.border}`,textAlign:"center"}}>
            <div style={{fontSize:12,fontFamily:"JetBrains Mono",color:t.green,marginBottom:8}}>{phase==="submitting"?"⟳  Submitting…":"⟳  Engines analyzing… (15–30s)"}</div>
            <div style={{height:3,borderRadius:99,background:t.border,overflow:"hidden",margin:"0 auto",maxWidth:220}}>
              <div style={{height:"100%",background:t.green,width:"40%",borderRadius:99,animation:"slide 1.4s ease-in-out infinite"}}/>
            </div>
          </div>
        )}

        {/* Error */}
        {error&&<div style={{padding:12,borderRadius:10,background:`${t.red}0d`,border:`1px solid ${t.red}33`,color:t.red,fontFamily:"JetBrains Mono",fontSize:11}}>✕ {error}</div>}

        {/* Results */}
        {result&&(
          <div className="fadein" style={{display:"flex",flexDirection:"column",gap:12}}
            onTouchStart={e=>{touchStartX.current=e.touches[0].clientX;}}
            onTouchEnd={e=>{
              if(touchStartX.current===null)return;
              const delta=e.changedTouches[0].clientX-touchStartX.current;
              touchStartX.current=null;
              if(Math.abs(delta)<50)return;
              const idx=TABS.indexOf(tab);
              if(delta<0&&idx<TABS.length-1)setTab(TABS[idx+1]);
              if(delta>0&&idx>0)setTab(TABS[idx-1]);
            }}>

            {/* URL + action row */}
            <div style={{display:"flex",gap:"clamp(4px,2vw,8px)",alignItems:"center",padding:"clamp(8px,2vw,10px) clamp(10px,2.5vw,13px)",borderRadius:10,background:t.inputBg,border:`1px solid ${t.border}`,flexWrap:"wrap"}}>
              <span style={{fontFamily:"JetBrains Mono",fontSize:"clamp(9px,2.5vw,11px)",color:t.code,flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",minWidth:80}}>{scannedUrl}</span>
              {[[copyMsg||"📋",handleCopy],[shareMsg||"🔗",handleShare],["⬇",handleExport],["🔁",()=>doScan(scannedUrl)]].map(([lbl,fn],i)=>(

                <button key={i} onClick={fn}
                  className="action-btn"
                  style={{border:`1px solid ${t.border}`,background:t.surface,color:t.muted}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=t.green} onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}
                  title={["Copy results","Share link","Export JSON","Re-scan"][i]}>{lbl}</button>
              ))}
            </div>

            {/* Stale scan warning */}
            {isStale&&(
              <div style={{padding:"8px 12px",borderRadius:10,background:`${t.yellow}0d`,border:`1px solid ${t.yellow}44`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                <span style={{fontSize:10,fontFamily:"JetBrains Mono",color:t.yellow}}>⚠ Analysis is {scanAgeDays} day{scanAgeDays>1?'s':''} old — results may be outdated.</span>
                <button onClick={()=>doScan(scannedUrl)} style={{fontSize:10,fontFamily:"JetBrains Mono",color:t.yellow,background:"transparent",border:`1px solid ${t.yellow}55`,borderRadius:6,padding:"3px 8px",cursor:"pointer"}}>Re-scan</button>
              </div>
            )}
            {/* Tab bar — scrollable on mobile */}
            <div className="tab-bar" style={{background:t.inputBg,border:`1px solid ${t.border}`}}>
              {TABS.map(id=><button key={id} className="tab-btn" onClick={()=>setTab(id)}
                style={{background:tab===id?t.green:"transparent",color:tab===id?(dark?"#0a0a0f":"#fff"):t.muted}}>{id}</button>)}
            </div>

            {/* ── Overview ──────────────────────────────────── */}
            {tab==="Overview"&&(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{display:"flex",gap:12,alignItems:"center",padding:16,borderRadius:14,background:`${rc}0d`,border:`1px solid ${rc}33`,flexWrap:"wrap"}}>
                  <RiskGauge score={risk.score} label={risk.label} colorKey={risk.color} t={t}/>
                  <div style={{flex:1,minWidth:160}}>
                    <div style={{fontSize:17,fontWeight:800,color:rc,letterSpacing:-0.5}}>{mal===0&&sus===0?"✓ No threats detected":`⚠ ${mal+sus} engine${mal+sus>1?"s":""} flagged`}</div>
                    <div style={{fontSize:11,color:t.muted,marginTop:5,fontFamily:"JetBrains Mono"}}>{tot} engines · {lastAnalysisDate||"just now"}</div>
                    {result.categories&&Object.keys(result.categories).length>0&&<div style={{marginTop:8}}><CategoryTags categories={result.categories} t={t}/></div>}
                  </div>
                </div>
                <ThreatBar mal={mal} sus={sus} har={har} und={und} t={t}/>
                {/* Legend toggle */}
                <div style={{display:"flex",justifyContent:"flex-end"}}>
                  <button onClick={()=>setShowLegend(s=>!s)}
                    style={{fontSize:10,fontFamily:"JetBrains Mono",color:t.muted,background:"transparent",border:`1px solid ${t.border}`,borderRadius:6,padding:"3px 8px",cursor:"pointer"}}>
                    {showLegend?"Hide legend":"What does this mean?"}
                  </button>
                </div>
                {showLegend&&(
                  <div style={{display:"flex",flexDirection:"column",gap:6,padding:"12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.border}`}}>
                    {[[t.red,"Malicious","Confirmed harmful — phishing, malware, scam, or exploit."],[t.yellow,"Suspicious","Flagged but not confirmed; treat with caution."],[t.green,"Harmless","Engine found no threats and considers this URL safe."],[t.muted,"Undetected","Engine did not analyse or has no data for this URL."]].map(([c,lbl,desc])=>(
                      <div key={lbl} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                        <div style={{width:8,height:8,borderRadius:2,background:c,marginTop:3,flexShrink:0}}/>
                        <div><span style={{fontFamily:"JetBrains Mono",fontSize:10,fontWeight:700,color:c}}>{lbl}: </span><span style={{fontFamily:"JetBrains Mono",fontSize:10,color:t.muted}}>{desc}</span></div>
                      </div>
                    ))}
                  </div>
                )}
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
                    <div style={{fontSize:9,fontFamily:"JetBrains Mono",color:t.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>🔀 Redirect Chain ({redirects.length} hops)</div>
                    {redirects.map((r,i)=>(
                      <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:i<redirects.length-1?6:0}}>
                        <span style={{fontFamily:"JetBrains Mono",fontSize:9,color:t.muted,flexShrink:0,paddingTop:1}}>#{i+1}</span>
                        <span style={{fontFamily:"JetBrains Mono",fontSize:10,color:i===redirects.length-1?t.green:t.yellow,wordBreak:"break-all"}}>{r}</span>
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
                    <span style={{fontSize:9,fontFamily:"JetBrains Mono",color:t.muted,letterSpacing:1,textTransform:"uppercase"}}>Distribution</span>
                    <DonutChart mal={mal} sus={sus} har={har} und={und} t={t}/>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                    <span style={{fontSize:9,fontFamily:"JetBrains Mono",color:t.muted,letterSpacing:1,textTransform:"uppercase"}}>Profile</span>
                    <RadarChart mal={mal} sus={sus} har={har} und={und} t={t}/>
                  </div>
                </div>
                {/* Stats grid */}
                <div className="info-grid">
                  {[["🔴 Malicious",mal,t.red],["🟡 Suspicious",sus,t.yellow],["✅ Harmless",har,t.green],["⚪ Undetected",und,t.muted]].map(([lbl,val,color],i)=>(
                    <div key={i} style={{padding:"clamp(10px,3vw,14px)",borderRadius:12,background:t.inputBg,border:`1px solid ${color}33`,display:"flex",flexDirection:"column",gap:4}}>
                      <span style={{fontSize:"clamp(18px,5vw,24px)",fontWeight:800,fontFamily:"JetBrains Mono",color}}>{val}</span>
                      <span style={{fontSize:10,color:t.muted,fontFamily:"JetBrains Mono"}}>{lbl}</span>
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
                    <div style={{fontSize:9,fontFamily:"JetBrains Mono",color:t.muted,letterSpacing:1,marginBottom:6,textTransform:"uppercase"}}>Flagged ({flagged.length})</div>
                    <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:260,overflowY:"auto"}}>
                      {flagged.map(([name,data])=>{
                        const ec=data.category==="malicious"?t.red:t.yellow;
                        return(
                          <button key={name} onClick={()=>{navigator.clipboard.writeText(`${name}: ${data.result||data.category}`);setCopiedEngine(name);setTimeout(()=>setCopiedEngine(null),1500);}}
                            title="Click to copy"
                            style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 11px",borderRadius:9,background:copiedEngine===name?`${ec}22`:`${ec}0a`,border:`1px solid ${ec}33`,cursor:"pointer",textAlign:"left",width:"100%",transition:"background 0.2s"}}>
                            <span style={{fontFamily:"JetBrains Mono",fontSize:11,color:t.muted}}>{name}</span>
                            <span style={{fontSize:10,fontFamily:"JetBrains Mono",color:copiedEngine===name?ec:ec,textAlign:"right",marginLeft:8}}>{copiedEngine===name?"Copied!":data.result||data.category}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {flagged.length===0&&<div style={{textAlign:"center",padding:18,fontFamily:"JetBrains Mono",fontSize:12,color:t.green}}>✓ Zero engines flagged this URL</div>}
                {clean.length>0&&(
                  <details>
                    <summary style={{fontSize:9,fontFamily:"JetBrains Mono",color:t.muted,letterSpacing:1,textTransform:"uppercase",userSelect:"none",padding:"4px 0"}}>Clean Engines ({clean.length}) ▾</summary>
                    <div style={{display:"flex",flexDirection:"column",gap:3,marginTop:6,maxHeight:240,overflowY:"auto"}}>
                      {clean.map(([name])=>(
                        <div key={name} style={{display:"flex",justifyContent:"space-between",padding:"6px 11px",borderRadius:8,background:t.inputBg,border:`1px solid ${t.border}`}}>
                          <span style={{fontFamily:"JetBrains Mono",fontSize:10,color:t.muted}}>{name}</span>
                          <span style={{fontSize:10,fontFamily:"JetBrains Mono",color:t.green}}>○ clean</span>
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
                <div style={{fontSize:9,fontFamily:"JetBrains Mono",color:t.muted,letterSpacing:1,textTransform:"uppercase"}}>SSL / TLS Certificate</div>
                <SSLCard ssl={ssl} t={t}/>
              </div>
            )}



          </div>
        )}



      </div>
      {result&&!bulkMode&&(
        <button onClick={reset} style={{position:"fixed",bottom:`calc(clamp(14px,4vw,20px) + env(safe-area-inset-bottom))`,left:"50%",transform:"translateX(-50%)",padding:"12px 32px",borderRadius:99,border:"none",background:t.green,color:dark?"#0a0a0f":"#fff",fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:`0 4px 24px ${t.green}55`,zIndex:100,whiteSpace:"nowrap",touchAction:"manipulation",letterSpacing:0.3}}>
          ↺ New Scan
        </button>
      )}
      {/* ── Footer ───────────────────────────────────────────── */}
      <div style={{width:"100%",maxWidth:560,marginTop:24,display:"flex",flexDirection:"column",alignItems:"center",gap:12,paddingBottom:`calc(clamp(16px,4vw,24px) + env(safe-area-inset-bottom))`}}>
        {/* Acentra Tech banner */}
        <a href="https://acentratech.web.app/" target="_blank" rel="noopener noreferrer"
          style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"12px 22px",borderRadius:12,border:`1px solid ${t.green}44`,background:`${t.green}08`,textDecoration:"none",transition:"all 0.2s",width:"100%",cursor:"pointer"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=t.green;e.currentTarget.style.background=`${t.green}12`;}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=`${t.green}44`;e.currentTarget.style.background=`${t.green}08`;}}>
          <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:13,color:t.green,letterSpacing:0.3}}>✦ Acentra Tech</span>
          <span style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,color:t.muted,textAlign:"center"}}>We're just getting started — but there's more where this came from.</span>
          <span style={{fontFamily:"JetBrains Mono",fontSize:9,color:`${t.green}99`,marginTop:2}}>acentratech.web.app →</span>
        </a>
        {/* Social links */}
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
          {[
            {href:"https://www.linkedin.com/in/carlos-miguel-torres-2644a9332/",label:"LinkedIn",hc:"#0a66c2",
              icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>},
            {href:"https://www.facebook.com/JenxxAi",label:"Facebook",hc:"#1877f2",
              icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>},
            {href:"https://github.com/JenxxAI",label:"GitHub",hc:t.text,
              icon:<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>}
          ].map(({href,label,hc,icon})=>(
            <a key={label} href={href} target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",gap:5,color:t.muted,textDecoration:"none",fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:11,fontWeight:600,padding:"6px 12px",borderRadius:8,border:`1px solid ${t.border}`,background:t.surface,transition:"all 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=hc;e.currentTarget.style.color=hc;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.color=t.muted;}}>
              {icon}{label}
            </a>
          ))}
        </div>
        <p style={{fontSize:9,fontFamily:"JetBrains Mono",color:t.muted,textAlign:"center",opacity:0.7}}>500 scans/day · 4/min · Non-commercial use</p>
      </div>
    </div>
  </>);
}
