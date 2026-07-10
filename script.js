
const $=(s,r=document)=>r.querySelector(s);
const gallery=["assets/img/camera-01.jpg", "assets/img/camera-02.jpg", "assets/img/camera-03.jpg", "assets/img/camera-04.jpg", "assets/img/camera-05.jpg", "assets/img/camera-06.jpg", "assets/img/camera-07.jpg", "assets/img/camera-08.jpg", "assets/img/camera-09.jpg", "assets/img/camera-10.jpg", "assets/img/camera-11.jpg", "assets/img/camera-12.jpg", "assets/img/camera-13.jpg", "assets/img/camera-14.jpg", "assets/img/camera-15.jpg", "assets/img/camera-16.jpg", "assets/img/camera-17.jpg"];
let lb=0;
function openLightbox(i){lb=i;$('#lb-img').src=gallery[lb];$('.lightbox').style.display='flex';}
function closeLightbox(){$('.lightbox').style.display='none';}
function stepLightbox(d){lb=(lb+d+gallery.length)%gallery.length;$('#lb-img').src=gallery[lb];}
window.openLightbox=openLightbox; window.closeLightbox=closeLightbox; window.stepLightbox=stepLightbox;
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox();if(e.key==='ArrowRight')stepLightbox(1);if(e.key==='ArrowLeft')stepLightbox(-1);});

// Menu mobile: funzione di supporto. La gestione principale è anche inline in index.html per evitare problemi di cache.
(function(){
  function ready(fn){ if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(function(){
    const toggle = document.getElementById('mobile-menu-button') || document.querySelector('.mobile-menu-toggle');
    const menu = document.getElementById('mobile-menu');
    if(!toggle || !menu || toggle.dataset.bound === '1') return;
    toggle.dataset.bound = '1';
    function close(){
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden','true');
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded','false');
      document.body.classList.remove('menu-open');
    }
    toggle.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      if(window.toggleMobileMenu) window.toggleMobileMenu(e);
      else {
        const open = !menu.classList.contains('is-open');
        menu.classList.toggle('is-open', open);
        menu.setAttribute('aria-hidden', String(!open));
        toggle.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('menu-open', open);
      }
    });
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  });
})();

// Calendario disponibilità Booking + Airbnb con tariffe dirette
(function(){
  const monthsRoot = document.getElementById('calendar-months');
  if (!monthsRoot) return;

  const monthNames = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const weekdays = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
  const todayIso = localIso(new Date());
  let cursor = new Date(); cursor.setDate(1); cursor.setHours(0,0,0,0);
  let blocked = new Set();
  let arrival = null;
  let departure = null;
  let loaded = false;

  function localIso(date){
    const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,'0'), d=String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }
  function fromIso(iso){ const [y,m,d]=iso.split('-').map(Number); return new Date(y,m-1,d); }
  function addDay(iso, n=1){ const d=fromIso(iso); d.setDate(d.getDate()+n); return localIso(d); }
  function formatDate(iso){ return iso ? new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'long',year:'numeric'}).format(fromIso(iso)) : 'Seleziona'; }
  function nightsBetween(a,b){ return Math.round((fromIso(b)-fromIso(a))/86400000); }
  function eachNight(a,b){ const out=[]; for(let x=a;x<b;x=addDay(x)) out.push(x); return out; }
  function nightlyRate(iso){
    const d=fromIso(iso);
    const y=d.getFullYear(), m=d.getMonth()+1, day=d.getDate();
    if(y===2026 && m===7) return 85;
    if(y===2026 && m===8) return day>=10 && day<=16 ? 120 : 100;
    if(y===2026 && m===9) return 85;
    if(y===2026 && m===10) return 80;
    if(y===2026 && m===11) return 70;
    if(y===2026 && m===12) return [24,25,26,30,31].includes(day) ? 80 : 70;
    if(y===2027 && m===1) return day===1 ? 80 : 70;
    return null;
  }
  function stayQuote(a,b){
    const nights=eachNight(a,b);
    const rows=nights.map(date=>({date,rate:nightlyRate(date)}));
    const complete=rows.every(row=>Number.isFinite(row.rate));
    return {rows,complete,total:complete?rows.reduce((sum,row)=>sum+row.rate,0):null};
  }
  function euro(value){ return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value); }
  function validDeparture(candidate){
    if(!arrival || candidate<=arrival) return false;
    return !eachNight(arrival,candidate).some(day=>blocked.has(day));
  }
  function canChoose(iso){
    if(iso<todayIso) return false;
    if(!arrival || departure) return !blocked.has(iso);
    return validDeparture(iso);
  }
  function loadRanges(ranges){
    blocked.clear();
    (ranges||[]).forEach(r=>{ for(let x=r.start;x<r.end;x=addDay(x)) blocked.add(x); });
  }
  function renderMonth(base){
    const y=base.getFullYear(), m=base.getMonth();
    const first=new Date(y,m,1); const days=new Date(y,m+1,0).getDate();
    const offset=(first.getDay()+6)%7;
    const wrap=document.createElement('section'); wrap.className='calendar-month';
    wrap.innerHTML=`<h3>${monthNames[m]} ${y}</h3><div class="calendar-weekdays">${weekdays.map(w=>`<span>${w}</span>`).join('')}</div><div class="calendar-days"></div>`;
    const grid=wrap.querySelector('.calendar-days');
    for(let i=0;i<offset;i++){ const e=document.createElement('span');e.className='calendar-empty';grid.appendChild(e); }
    for(let day=1;day<=days;day++){
      const iso=localIso(new Date(y,m,day));
      const btn=document.createElement('button'); btn.type='button';btn.className='calendar-day';btn.dataset.date=iso;
      const rate=nightlyRate(iso);
      btn.innerHTML=`<span class="calendar-day-number">${day}</span>${rate!==null?`<small>${rate}€</small>`:''}`;
      if(rate===null) btn.classList.add('rate-unset');
      if(iso<todayIso) btn.classList.add('past');
      if(blocked.has(iso)) btn.classList.add('busy');
      if(arrival===iso) btn.classList.add('selected','checkin');
      if(departure===iso) btn.classList.add('selected','checkout');
      if(arrival && departure && iso>arrival && iso<departure) btn.classList.add('range');
      btn.disabled=!loaded || !canChoose(iso);
      btn.setAttribute('aria-label',`${day} ${monthNames[m]} ${y}${blocked.has(iso)?', non disponibile':rate!==null?`, disponibile, ${rate} euro a notte`:', disponibile, tariffa su richiesta'}`);
      btn.addEventListener('click',()=>selectDate(iso));
      grid.appendChild(btn);
    }
    return wrap;
  }
  function render(){
    monthsRoot.innerHTML='';
    monthsRoot.appendChild(renderMonth(new Date(cursor.getFullYear(),cursor.getMonth(),1)));
    if(window.innerWidth>980) monthsRoot.appendChild(renderMonth(new Date(cursor.getFullYear(),cursor.getMonth()+1,1)));
    updateSummary();
  }
  function selectDate(iso){
    if(!arrival || departure){ arrival=iso; departure=null; }
    else if(validDeparture(iso)){ departure=iso; }
    render();
  }
  function updateSummary(){
    document.getElementById('stay-arrival').textContent=formatDate(arrival);
    document.getElementById('stay-departure').textContent=formatDate(departure);
    const summary=document.getElementById('stay-summary');
    const wa=document.getElementById('wa-request');
    if(arrival && departure){
      const nights=nightsBetween(arrival,departure);
      const quote=stayQuote(arrival,departure);
      if(quote.complete){
        summary.innerHTML=`<strong>${nights} ${nights===1?'notte':'notti'}</strong><span class="stay-total">Totale soggiorno: <b>${euro(quote.total)}</b></span><small>Tariffa della camera. Eventuale tassa di soggiorno esclusa.</small>`;
        wa.textContent=`Richiedi ${nights} ${nights===1?'notte':'notti'} • ${euro(quote.total)}`;
      } else {
        summary.innerHTML=`<strong>${nights} ${nights===1?'notte':'notti'}</strong><span class="stay-total">Tariffa da confermare</span><small>Alcune date selezionate non hanno ancora un prezzo pubblicato.</small>`;
        wa.textContent='Richiedi disponibilità e tariffa';
      }
      wa.classList.remove('disabled');wa.setAttribute('aria-disabled','false');wa.href='#';
    } else {
      summary.textContent=arrival?'Ora seleziona la data di partenza.':'Seleziona prima la data di arrivo e poi quella di partenza.';
      wa.textContent='Richiedi disponibilità su WhatsApp';
      wa.classList.add('disabled');wa.setAttribute('aria-disabled','true');wa.href='#';
    }
  }
  document.getElementById('calendar-prev').addEventListener('click',()=>{ const now=new Date();now.setDate(1); if(cursor>now){cursor.setMonth(cursor.getMonth()-1);render();} });
  document.getElementById('calendar-next').addEventListener('click',()=>{cursor.setMonth(cursor.getMonth()+1);render();});
  document.getElementById('calendar-reset').addEventListener('click',()=>{arrival=null;departure=null;render();});
  document.getElementById('wa-request').addEventListener('click',e=>{
    e.preventDefault(); if(!arrival||!departure) return;
    const guests=document.getElementById('guests').value;
    const nights=nightsBetween(arrival,departure);
    const quote=stayQuote(arrival,departure);
    const priceText=quote.complete?` Il totale indicato dal sito è ${euro(quote.total)}, esclusa l'eventuale tassa di soggiorno.`:' La tariffa per queste date è da confermare.';
    const msg=`Buongiorno, vorrei richiedere la disponibilità di Marconi306 dal ${formatDate(arrival)} al ${formatDate(departure)} (${nights} ${nights===1?'notte':'notti'}) per ${guests} ${guests==='1'?'ospite':'ospiti'}.${priceText} Le date risultano disponibili sul sito; attendo conferma. Grazie!`;
    window.open('https://wa.me/393278562974?text='+encodeURIComponent(msg),'_blank','noopener');
  });
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,150);});

  fetch('/api/availability',{headers:{'Accept':'application/json'}})
    .then(r=>{if(!r.ok) throw new Error('availability');return r.json();})
    .then(data=>{loadRanges(data.blockedRanges);loaded=true;document.getElementById('calendar-status').textContent='Calendario aggiornato';render();})
    .catch(()=>{loaded=false;document.getElementById('calendar-status').textContent='Disponibilità non caricata';monthsRoot.innerHTML='<p class="calendar-note">Il calendario non è temporaneamente disponibile. Contattaci direttamente su WhatsApp.</p>';updateSummary();});
  render();
})();
