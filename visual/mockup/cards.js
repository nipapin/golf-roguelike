// Card markup helper for the mockups. Mirrors STYLE.md card anatomy.
const SUIT={sp:'spade',he:'heart',cl:'club',di:'diamond'};
const FXI={sp:'sword',he:'plus',cl:'shield',di:'coins'};
const PW={crit:['CRIT','crit'],heal:['HEAL','heart-shine'],guard:['GUARD','shield'],gold:['GOLD','coins'],bomb:['BOMB','bomb'],wild:['WILD','joker'],echo:['ECHO','echo']};
function use(id,cls='i'){return `<svg class="${cls}" viewBox="0 0 512 512"><use href="#${id}"/></svg>`}
function card(o){
  const s=o.s, cls=['card',s,o.state||'',o.power?'power pw-'+o.power:''].join(' ');
  const st=`left:${o.x||0}px;top:${o.y||0}px;${o.z!=null?'z-index:'+o.z+';':''}${o.style||''}`;
  let h=`<div class="${cls}" style="${st}">`;
  if(o.power) h+=`<div class="holo"></div>`;
  h+=`<div class="rank${o.r==='10'?' ten':''}">${o.r}</div>`;
  h+=`<svg class="pip" viewBox="-8 -8 116 116"><use href="#s-${SUIT[s]}"/></svg>`;
  h+=`<div class="bigw"><svg class="big" viewBox="-8 -8 116 116"><use href="#s-${SUIT[s]}"/></svg>${use('i-'+FXI[s],'fxg')}</div>`;
  if(o.power){const p=PW[o.power];
    h+=`<div class="medal">${use('i-'+p[1])}</div><div class="ribbon">${p[0]}</div>`;
    (o.sparks||[[8,30],[34,52]]).forEach(([a,b])=>h+=`<i class="spark" style="left:${a}%;top:${b}%"></i>`);
  }
  if(o.state&&o.state.includes('playable')) h+=`<i class="tick"></i>`;
  return h+`</div>`;
}
function back(x,y,st=''){return `<div class="back" style="left:${x}px;top:${y}px;${st}"><div class="emb">${use('i-swords')}</div></div>`}
const SHIELD_SVG=(c1='#7FD0FF',c2='#1C6FE0')=>`<svg viewBox="0 0 36 40"><defs><linearGradient id="sg${c1.slice(1)}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><path d="M18 2.5 L33 7.5 C33 22 28 31.5 18 37.5 C8 31.5 3 22 3 7.5 Z" fill="url(#sg${c1.slice(1)})" stroke="#1B1030" stroke-width="3" stroke-linejoin="round"/><path d="M18 6 L29 9.6 C29 13 28.4 16 27.3 18.6 L18 16 Z" fill="#fff" opacity=".35"/></svg>`;
