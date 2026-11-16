(function(){
  // Momentum on-screen diagnostics v6 (opt-in): ?diag=1 (or ?diag=prof) runs two timed loads; CLOSE hides it and turns it off; ?diag=off also turns it off
  // (first load, repeat load, repeat load with saved state cleared) and names the slowest operations.
  // Off for normal visits. Prints no secrets (storage keys and sizes only, never values).
  try{
    var q=location.search, ss=sessionStorage;
    if(/[?&]diag=off/.test(q)){ss.removeItem('mdMode');ss.removeItem('mdStep');ss.removeItem('mdRes');return}
    if(/[?&]diag=(prof|1|auto)/.test(q)&&ss.getItem('mdMode')!=='prof'){ss.setItem('mdMode','prof');ss.setItem('mdStep','0');ss.setItem('mdRes','[]')}
    if(ss.getItem('mdMode')!=='prof') return;
    var STEPS=['load A','load B (repeat)'];
    var step=+(ss.getItem('mdStep')||0), done=step>=STEPS.length;
    var L=[],t0=performance.now(),box; function now(){return (performance.now()-t0)/1000}
    function draw(){if(!document.body)return;if(!box){box=document.createElement('div');box.id='mdiag';box.style.cssText='position:fixed;left:0;right:0;top:0;max-height:75%;overflow:auto;z-index:2147483647;background:#fff;color:#000;font:11px/1.35 Menlo,monospace;padding:44px 8px 8px;white-space:pre-wrap;word-break:break-word;border-bottom:3px solid #e11';
      var b=document.createElement('button');b.textContent='COPY THIS TEXT';b.style.cssText='display:block;margin:0 0 6px;padding:8px 12px;font:bold 13px sans-serif;background:#e11;color:#fff;border:0;border-radius:6px';
      b.onclick=function(){var x=box.lastChild.textContent;(navigator.clipboard?navigator.clipboard.writeText(x):Promise.reject()).then(function(){b.textContent='COPIED - paste it to Claude'},function(){b.textContent='select the text and copy by hand'})};
      var x=document.createElement('button');x.textContent='CLOSE';x.style.cssText='position:absolute;right:8px;top:8px;padding:8px 12px;font:bold 13px sans-serif;background:#222;color:#fff;border:0;border-radius:6px';x.onclick=function(){window.__mdClosed=true;ss.removeItem('mdMode');ss.removeItem('mdStep');ss.removeItem('mdRes');if(box.parentNode)box.parentNode.removeChild(box)};box.appendChild(x);box.style.position='fixed';
      box.appendChild(b);box.appendChild(document.createElement('div'))}
      if(window.__mdClosed)return;if(box.parentNode!==document.body)document.body.appendChild(box);box.lastChild.textContent=L.join('\n')}
    function log(s){L.push(s);draw()}
    if(done){var R=JSON.parse(ss.getItem('mdRes')||'[]');L.push('MOMENTUM DIAG v6 SUMMARY');L.push(navigator.userAgent.replace(/Mozilla\/5.0 /,''));
      R.forEach(function(r){L.push('');L.push('RUN '+r.name+': visible at '+r.visibleAt+' | longest freeze '+r.stall);L.push('  milestones: '+r.ms);L.push('  saved state at start: '+r.store);L.push('  slow operations: '+(r.slow||'none over 50 ms'));L.push('  background thread during the freeze: '+r.worker);L.push('  last calls BEFORE the freeze: '+r.before);L.push('  first calls AFTER the freeze: '+r.after);L.push('  injected into the page: '+r.inj);if(r.errs)L.push('  errors: '+r.errs)});
      L.push('');L.push('END - tap COPY THIS TEXT');ss.removeItem('mdMode');ss.removeItem('mdStep');document.addEventListener('DOMContentLoaded',draw);draw();return}
    var res={name:STEPS[step],visibleAt:'never (10s)',stall:'',ms:'',store:'',slow:'',errs:'',worker:'not started',before:'',after:'',inj:''},errs=[],ops=[],ms=[],bc=[];
    function crumb(n){if(bc.length<4000)bc.push([performance.now(),n])}
    function mark(n){ms.push(n+' '+now().toFixed(2)+'s')}
    function op(kind,detail,start,dur){if(dur>=50)ops.push({k:kind,d:String(detail).slice(0,70),s:(start-t0)/1000,ms:dur})}
    function stackTop(){try{return (new Error().stack||'').split('\n').slice(2,5).map(function(l){var m=l.match(/([A-Za-z0-9_.-]+\.js):(\d+):(\d+)/);return m?m[1].replace(/-[A-Za-z0-9_-]{8}\.js/,'')+':'+m[2]+':'+m[3]:''}).filter(Boolean).join('<')}catch(e){return ''}}
    // saved state at start (keys and sizes only)
    try{{var parts=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);parts.push(k.slice(0,28)+'='+((localStorage.getItem(k)||'').length/1024).toFixed(1)+'KB')}res.store=parts.join(', ')||'empty'}}catch(e){res.store='storage error '+e.message}
    mark('diag start');
    // heartbeat
    var last=performance.now(),maxGap=0,gapAt=0,gapS=0,gapE=0,gapWallS=0,lastWall=Date.now();setInterval(function(){var n=performance.now(),g=n-last;if(g>maxGap){maxGap=g;gapAt=last-t0;gapS=last;gapE=n;gapWallS=lastWall}last=n;lastWall=Date.now()},50);
    var wk=null;try{wk=new Worker('/diag-worker.js');res.worker='started'}catch(e){res.worker='could not start: '+e.message}
    // --- poor man's profiler: time the things that can block the main thread ---
    try{['getItem','setItem','removeItem'].forEach(function(m){var o=Storage.prototype[m];Storage.prototype[m]=function(k,v){var s=performance.now();try{return o.apply(this,arguments)}finally{var d=performance.now()-s;if(d>=50)op('storage.'+m,(this===window.sessionStorage?'session:':'local:')+String(k).slice(0,24)+(v?' '+(String(v).length/1024).toFixed(0)+'KB':'')+' @'+stackTop(),s,d)}}})}catch(e){}
    try{['parse','stringify'].forEach(function(m){var o=JSON[m];JSON[m]=function(a){var s=performance.now();try{return o.apply(JSON,arguments)}finally{var d=performance.now()-s;if(d>=50)op('JSON.'+m,(typeof a==='string'?(a.length/1024).toFixed(0)+'KB':'object')+' @'+stackTop(),s,d)}}})}catch(e){}
    function timed(kind,fn,label){return function(){var s=performance.now();try{return fn.apply(this,arguments)}finally{var d=performance.now()-s;if(d>=50)op(kind,label||String(fn).replace(/\s+/g,' ').slice(0,60),s,d)}}}
    try{var oST=window.setTimeout;window.setTimeout=function(fn,ms2){if(typeof fn!=='function')return oST.apply(window,arguments);var a=[].slice.call(arguments);a[0]=timed('timer('+(ms2||0)+'ms)',fn);return oST.apply(window,a)}}catch(e){}
    try{var oRAF=window.requestAnimationFrame;window.requestAnimationFrame=function(fn){return oRAF.call(window,timed('animation frame',fn))}}catch(e){}
    try{var OMC=window.MessageChannel;window.MessageChannel=function(){var mc=new OMC(),h=null;Object.defineProperty(mc.port1,'onmessage',{configurable:true,get:function(){return h},set:function(fn){if(h)return;h=fn;mc.port1.addEventListener('message',timed('scheduler task (app render)',fn,'React work'));mc.port1.start()}});return mc};window.MessageChannel.prototype=OMC.prototype}catch(e){}
    try{var oAEL=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(type,fn,o){if(typeof fn==='function'&&(this===window||this===document)&&/^(load|DOMContentLoaded|pageshow|visibilitychange|focus|online|storage)$/.test(type)){var w=timed('listener '+type,fn);return oAEL.call(this,type,w,o)}return oAEL.apply(this,arguments)}}catch(e){}
    try{var oIDB=indexedDB.open.bind(indexedDB);indexedDB.open=function(n){var s=performance.now();var r=oIDB.apply(indexedDB,arguments);var d=performance.now()-s;if(d>=50)op('indexedDB.open',n,s,d);var s2=performance.now();r.addEventListener('success',function(){var d2=performance.now()-s2;if(d2>=1500)ops.push({k:'indexedDB.open wait (not blocking)',d:String(n),s:(s2-t0)/1000,ms:d2})});return r}}catch(e){}
    try{var cd=Object.getOwnPropertyDescriptor(Document.prototype,'cookie');if(cd&&cd.get)Object.defineProperty(document,'cookie',{configurable:true,get:function(){var s=performance.now();try{return cd.get.call(document)}finally{var d=performance.now()-s;if(d>=50)op('document.cookie read','@'+stackTop(),s,d)}},set:function(v){return cd.set.call(document,v)}})}catch(e){}
    function wrapFn(obj,name,label){try{var o=obj[name];if(typeof o!=='function')return;obj[name]=function(){crumb(label);var s=performance.now();try{return o.apply(this,arguments)}finally{var d=performance.now()-s;if(d>=50)op('call '+label,'@'+stackTop(),s,d)}}}catch(e){}}
    function wrapCtor(name){try{var O=window[name];if(!O)return;var W=function(a,b,c){crumb('new '+name);var s=performance.now();try{return arguments.length===0?new O():arguments.length===1?new O(a):arguments.length===2?new O(a,b):new O(a,b,c)}finally{var d=performance.now()-s;if(d>=50)op('new '+name,String(a).slice(0,40),s,d)}};W.prototype=O.prototype;Object.getOwnPropertyNames(O).forEach(function(k){if(!(k in W))try{W[k]=O[k]}catch(e){}});window[name]=W}catch(e){}}
    wrapFn(window,'fetch','fetch');wrapFn(window,'matchMedia','matchMedia');wrapFn(window,'getComputedStyle','getComputedStyle');
    wrapFn(document,'getElementById','getElementById');wrapFn(history,'pushState','history.pushState');wrapFn(history,'replaceState','history.replaceState');
    wrapFn(console,'log','console.log');wrapFn(console,'error','console.error');wrapFn(console,'warn','console.warn');
    try{wrapFn(navigator.locks,'request','locks.request')}catch(e){}
    try{wrapFn(navigator.serviceWorker,'getRegistrations','sw.getRegistrations');wrapFn(navigator.serviceWorker,'getRegistration','sw.getRegistration');wrapFn(navigator.serviceWorker,'register','sw.register')}catch(e){}
    try{wrapFn(crypto,'getRandomValues','crypto.getRandomValues');wrapFn(crypto,'randomUUID','crypto.randomUUID')}catch(e){}
    try{wrapFn(document,'createElement','createElement')}catch(e){}
    ['WebSocket','Worker','BroadcastChannel','MutationObserver','IntersectionObserver','ResizeObserver','Image','Audio','AudioContext','webkitAudioContext','Notification','EventSource','SharedWorker'].forEach(wrapCtor);
    try{var nd=Object.getOwnPropertyDescriptor(window.Notification||{},'permission');if(nd&&nd.get)Object.defineProperty(Notification,'permission',{configurable:true,get:function(){crumb('Notification.permission');var s=performance.now();try{return nd.get.call(Notification)}finally{var d=performance.now()-s;if(d>=50)op('Notification.permission','',s,d)}}})}catch(e){}
    var appStarted=false,oGE=document.getElementById;document.getElementById=function(id){if(!appStarted&&id==='root'){appStarted=true;mark('APP CODE STARTED')}return oGE.apply(document,arguments)};
    function inventory(){try{var out=[];[].forEach.call(document.documentElement.attributes,function(a){if(a.name!=='lang'&&a.name!=='class'&&a.name!=='style'&&a.name!=='dir')out.push('html@'+a.name)});[document.head,document.body,document.documentElement].forEach(function(p){if(!p)return;[].forEach.call(p.children,function(e){var t=e.tagName.toLowerCase();if(e.id==='root'||e.id==='mdiag'||t==='head'||t==='body'||t==='meta'||t==='title')return;var src=e.src||e.href||'';if(t==='script'&&!src&&/MOMENTUM DIAG/.test(e.textContent||''))return;if((t==='script'||t==='link')&&src&&(src.indexOf(location.origin)===0||/onesignal/.test(src)))return;out.push(t+(e.id?'#'+e.id.slice(0,24):'')+(e.className&&typeof e.className==='string'?'.'+e.className.slice(0,24):'')+(src?'['+src.slice(0,50)+']':'')+(t==='style'?'('+(e.textContent||'').length+'ch)':''))})});return out.slice(0,12).join(', ')||'nothing unexpected'}catch(e){return 'error '+e.message}}
    document.addEventListener('readystatechange',function(){mark('readyState '+document.readyState)});
    document.addEventListener('DOMContentLoaded',function(){mark('page parsed');draw()});
    window.addEventListener('load',function(){mark('load event')});
    document.addEventListener('visibilitychange',function(){mark('visibility '+document.visibilityState)});
    window.addEventListener('error',function(e){var t=e.target;errs.push(now().toFixed(1)+'s '+(e.message?String(e.message).slice(0,60)+' file='+String(e.filename||'(none)').slice(0,60)+':'+(e.lineno||0)+(e.error&&e.error.stack?' stack='+String(e.error.stack).replace(/\s+/g,' ').slice(0,90):''):'load failed '+String(t&&(t.src||t.href)||t&&t.tagName||'?').slice(0,70)))},true);
    window.addEventListener('unhandledrejection',function(e){var r=e.reason;errs.push(now().toFixed(1)+'s '+String(r&&(r.message||r)||r).slice(0,70))});
    var rootSeen=false,seen=false;
    function vis(){var root=document.getElementById('root');if(!root)return 0;if(!rootSeen&&root.children.length){rootSeen=true;mark('first app content in page')}var n=0;[].forEach.call(root.querySelectorAll('*'),function(e){if(e.children.length||!e.innerText||!e.innerText.trim())return;var r=e.getBoundingClientRect(),o=1,x=e;while(x&&x!==document.body){o*=parseFloat(getComputedStyle(x).opacity||'1');x=x.parentElement}if(r.width>1&&r.height>1&&o>0.5)n++});return n}
    var iv=setInterval(function(){if(!seen&&vis()>=3){seen=true;res.visibleAt=now().toFixed(1)+'s';mark('screen visible')}},100);
    log('MOMENTUM DIAG v4 run '+(step+1)+'/3: '+STEPS[step]+' ... wait');
    oST.call(window,function(){clearInterval(iv);
      res.stall=(maxGap/1000).toFixed(1)+'s starting at '+(gapAt/1000).toFixed(1)+'s';
      try{var nv=performance.getEntriesByType('navigation')[0];if(nv)ms.push('[browser: response '+(nv.responseEnd/1000).toFixed(2)+' interactive '+(nv.domInteractive/1000).toFixed(2)+' parsed '+(nv.domContentLoadedEventEnd/1000).toFixed(2)+' load '+(nv.loadEventStart/1000).toFixed(2)+' type '+nv.type+']')}catch(e){}
      try{var rs=performance.getEntriesByType('resource').filter(function(e){return /\.js(\?|$)/.test(e.name)}).sort(function(a,b){return b.responseEnd-a.responseEnd})[0];if(rs)ms.push('[last script arrived '+(rs.responseEnd/1000).toFixed(2)+'s]')}catch(e){}
      res.ms=ms.join(', ');
      ops.sort(function(a,b){return b.ms-a.ms});res.slow=ops.slice(0,7).map(function(o){return o.k+' '+(o.ms/1000).toFixed(1)+'s at '+o.s.toFixed(1)+'s ('+o.d+')'}).join(' | ');
      res.errs=errs.slice(0,5).join(' | ');
      function fmt(a){var o=[],prev=null,c=0;a.forEach(function(x){var k=x[1];if(k===prev){c++}else{if(prev)o.push(prev+(c>1?' x'+c:'')+'@'+lastT);prev=k;c=1}lastT=((x[0]-t0)/1000).toFixed(2)});if(prev)o.push(prev+(c>1?' x'+c:'')+'@'+lastT);return o.join(' > ')}var lastT='';
      res.before=fmt(bc.filter(function(x){return x[0]<=gapS+60}).slice(-14))||'none';res.after=fmt(bc.filter(function(x){return x[0]>=gapE-5}).slice(0,10))||'none';res.inj=inventory();
      var save=function(){var R=JSON.parse(ss.getItem('mdRes')||'[]');R.push(res);ss.setItem('mdRes',JSON.stringify(R));ss.setItem('mdStep',String(step+1));
        log('run '+(step+1)+' done: visible at '+res.visibleAt+', longest freeze '+res.stall+'. Next in 2s...');oST.call(window,function(){if(!window.__mdClosed)location.replace(location.pathname)},2000)};
      if(wk&&res.worker==='started'){var answered=false;wk.onmessage=function(e){if(answered)return;answered=true;var d=e.data||{};var overlap=d.gaps?d.gaps.filter(function(g){return g[0]<gapWallS+maxGap&&g[0]+g[1]>gapWallS}).map(function(g){return (g[1]/1000).toFixed(1)+'s'}):[];res.worker=(overlap.length?'ALSO stalled '+overlap.join(',')+' (whole page process paused)':'kept running (only the page main thread was blocked)')+'; its own longest pause '+((d.maxGap||0)/1000).toFixed(1)+'s; network checks '+(d.fetchOk||0)+' ok '+(d.fetchFail||0)+' failed, slowest '+((d.fetchMax||0)/1000).toFixed(1)+'s';save()};wk.onerror=function(e){if(answered)return;answered=true;res.worker='error '+(e.message||'');save()};wk.postMessage('report');oST.call(window,function(){if(!answered){answered=true;res.worker='no answer';save()}},1500)}else save()},10000);
  }catch(e){try{console.log('diag failed',e)}catch(_){}}
})();
