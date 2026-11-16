// Momentum diagnostics helper: background heartbeat + tiny network checks. Loaded only in ?diag=prof mode.
var last=Date.now(),maxGap=0,gaps=[],fetchOk=0,fetchFail=0,fetchMax=0;
setInterval(function(){var n=Date.now(),g=n-last;if(g>maxGap)maxGap=g;if(g>400)gaps.push([last,g]);last=n},100);
setInterval(function(){var s=Date.now();fetch('/version.json?d='+s,{cache:'no-store'}).then(function(r){return r.text()}).then(function(){fetchOk++;var d=Date.now()-s;if(d>fetchMax)fetchMax=d},function(){fetchFail++})},1000);
onmessage=function(){postMessage({maxGap:maxGap,gaps:gaps,fetchOk:fetchOk,fetchFail:fetchFail,fetchMax:fetchMax})};
