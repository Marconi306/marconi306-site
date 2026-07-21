
const $=(s,r=document)=>r.querySelector(s);
const gallery=["assets/img/camera-01.jpg", "assets/img/camera-02.jpg", "assets/img/camera-03.jpg", "assets/img/camera-04.jpg", "assets/img/camera-05.jpg", "assets/img/camera-06.jpg", "assets/img/camera-07.jpg", "assets/img/camera-08.jpg", "assets/img/camera-09.jpg", "assets/img/camera-10.jpg", "assets/img/camera-11.jpg", "assets/img/camera-12.jpg", "assets/img/camera-13.jpg", "assets/img/camera-14.jpg", "assets/img/camera-15.jpg", "assets/img/camera-16.jpg", "assets/img/camera-17.jpg", "assets/img/camera-18.jpg", "assets/img/camera-19.jpg"];
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

// Calendario disponibilità Booking + Airbnb con prezzi giornalieri
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
  function nightlyPrice(iso){
    const [y,m,d]=iso.split('-').map(Number);
    if(y===2026){
      if(m===7) return 85;
      if(m===8) return d>=10 && d<=16 ? 120 : 100;
      if(m===9) return 85;
      if(m===10) return 80;
      if(m===11) return 70;
      if(m===12) return [24,25,26,30,31].includes(d) ? 80 : 70;
    }
    if(y===2027 && m===1) return d===1 ? 80 : 70;
    return null;
  }
  function nightsBetween(a,b){ return Math.round((fromIso(b)-fromIso(a))/86400000); }
  function eachNight(a,b){ const out=[]; for(let x=a;x<b;x=addDay(x)) out.push(x); return out; }
  function stayPricing(a,b,guests=Number(document.getElementById('guests')?.value || 2)){
    if(!a || !b) return null;
    const prices = eachNight(a,b).map(nightlyPrice);
    if(!prices.every(price => Number.isFinite(price))) return null;
    const base = prices.reduce((sum, price) => sum + price, 0);
    const discount = guests === 1 ? Math.round(base * 0.10 * 100) / 100 : 0;
    return {base, discount, total: base - discount};
  }
  function stayTotal(a,b){ return stayPricing(a,b)?.total ?? null; }
  function euro(value){
    return new Intl.NumberFormat('it-IT',{
      style:'currency',
      currency:'EUR',
      maximumFractionDigits:0
    }).format(value);
  }
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
      const price=nightlyPrice(iso);
      btn.innerHTML=`<span class="calendar-day-number">${day}</span>${price ? `<span class="calendar-day-price">€${price}</span>` : ''}`;
      if(iso<todayIso) btn.classList.add('past');
      if(blocked.has(iso)) btn.classList.add('busy');
      if(arrival===iso) btn.classList.add('selected','checkin');
      if(departure===iso) btn.classList.add('selected','checkout');
      if(arrival && departure && iso>arrival && iso<departure) btn.classList.add('range');
      btn.disabled=!loaded || !canChoose(iso);
      btn.setAttribute('aria-label',`${day} ${monthNames[m]} ${y}${blocked.has(iso)?', non disponibile':', disponibile'}${price ? `, ${price} euro a notte` : ''}`);
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
    const arrivalEl=document.getElementById('stay-arrival');
    const departureEl=document.getElementById('stay-departure');
    const message=document.getElementById('stay-summary-message');
    const totalBox=document.getElementById('booking-total');
    const totalValue=document.getElementById('booking-total-value');
    const totalNote=document.getElementById('booking-total-note');
    const breakdown=document.getElementById('booking-breakdown');
    const baseValue=document.getElementById('booking-base-value');
    const discountRow=document.getElementById('booking-discount-row');
    const discountValue=document.getElementById('booking-discount-value');
    const discountBadge=document.getElementById('single-guest-discount');
    const bookingButton=document.getElementById('open-booking');

    arrivalEl.textContent=formatDate(arrival);
    departureEl.textContent=formatDate(departure);

    if(arrival && departure){
      const nights=nightsBetween(arrival,departure);
      const pricing=stayPricing(arrival,departure);
      const total=pricing?.total ?? null;

      message.innerHTML=`<strong>${nights} ${nights===1?'notte':'notti'}</strong>`;

      if(pricing){
        baseValue.textContent=euro(pricing.base);
        totalValue.textContent=euro(pricing.total);
        breakdown.hidden=false;
        totalBox.hidden=false;
        totalNote.hidden=false;
        discountRow.hidden=pricing.discount<=0;
        discountBadge.hidden=pricing.discount<=0;
        if(pricing.discount>0) discountValue.textContent=`−${euro(pricing.discount)}`;
      }else{
        breakdown.hidden=true;
        discountBadge.hidden=true;
        totalBox.hidden=true;
        totalNote.hidden=false;
        totalNote.textContent='Il totale non è disponibile per una o più date selezionate. Contattaci per la tariffa.';
      }

      const enabled = total !== null;
      bookingButton.classList.toggle('disabled', !enabled);
      bookingButton.setAttribute('aria-disabled', String(!enabled));
      bookingButton.disabled = !enabled;
    }else{
      message.textContent=arrival
        ? 'Ora seleziona la data di partenza.'
        : 'Seleziona prima la data di arrivo e poi quella di partenza.';
      breakdown.hidden=true;
      discountBadge.hidden=true;
      totalBox.hidden=true;
      totalNote.hidden=true;
      totalNote.textContent='La tassa di soggiorno (€1 per persona per notte) non è inclusa nel totale e dovrà essere pagata in contanti al momento del check-in.';
      bookingButton.classList.add('disabled');
      bookingButton.setAttribute('aria-disabled','true');
      bookingButton.disabled = true;
    }
  }
  document.getElementById('calendar-prev').addEventListener('click',()=>{ const now=new Date();now.setDate(1); if(cursor>now){cursor.setMonth(cursor.getMonth()-1);render();} });
  document.getElementById('calendar-next').addEventListener('click',()=>{cursor.setMonth(cursor.getMonth()+1);render();});
  document.getElementById('calendar-reset').addEventListener('click',()=>{arrival=null;departure=null;render();});
  const guestsSelect=document.getElementById('guests');
  guestsSelect.addEventListener('change',updateSummary);
  guestsSelect.addEventListener('input',updateSummary);
  const modal=document.getElementById('booking-modal');
  const bookingForm=document.getElementById('booking-form');
  const bookingError=document.getElementById('booking-error');
  const paypalContainer=document.getElementById('paypal-button-container');
  const paypalLoading=document.getElementById('paypal-loading');
  let paypalRendered=false;

  function showBookingError(message){
    bookingError.textContent=message;
    bookingError.hidden=false;
  }
  function clearBookingError(){ bookingError.hidden=true; bookingError.textContent=''; }
  function bookingPayload(){
    const formData=new FormData(bookingForm);
    return {
      start:arrival,
      end:departure,
      guests:Number(document.getElementById('guests').value),
      firstName:formData.get('firstName'),
      lastName:formData.get('lastName'),
      email:formData.get('email'),
      phone:formData.get('phone'),
      notes:formData.get('notes')
    };
  }
  function formReady(){ return bookingForm.reportValidity(); }
  function loadPayPalSdk(clientId, mode){
    return new Promise((resolve,reject)=>{
      if(window.paypal) return resolve();
      const script=document.createElement('script');
      script.src=`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=EUR&intent=capture&components=buttons&locale=it_IT`;
      script.dataset.environment=mode;
      script.onload=resolve;
      script.onerror=()=>reject(new Error('Impossibile caricare PayPal.'));
      document.head.appendChild(script);
    });
  }
  async function preparePayPal(){
    if(paypalRendered) return;
    try{
      const configResponse=await fetch('/api/paypal/config',{headers:{Accept:'application/json'}});
      const config=await configResponse.json();
      if(!config.configured) throw new Error('Il pagamento online non è ancora configurato. Contattaci su WhatsApp.');
      await loadPayPalSdk(config.clientId,config.mode);
      paypalLoading.textContent='Compila i dati e scegli PayPal oppure carta.';
      window.paypal.Buttons({
        style:{layout:'vertical',shape:'rect',label:'pay'},
        onClick(data,actions){
          clearBookingError();
          if(!formReady()) return actions.reject();
          return actions.resolve();
        },
        async createOrder(){
          clearBookingError();
          const response=await fetch('/api/paypal/create-order',{
            method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
            body:JSON.stringify(bookingPayload())
          });
          const result=await response.json();
          if(!response.ok) throw new Error(result.error||'Impossibile avviare il pagamento.');
          return result.id;
        },
        async onApprove(data){
          clearBookingError();
          paypalLoading.hidden=false;
          paypalLoading.textContent='Pagamento ricevuto. Stiamo confermando la prenotazione…';
          const response=await fetch('/api/paypal/capture-order',{
            method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
            body:JSON.stringify({orderID:data.orderID})
          });
          const result=await response.json();
          if(!response.ok) throw new Error(result.error||'Impossibile completare la prenotazione.');
          try { sessionStorage.setItem('m306BookingSuccess',JSON.stringify(result)); } catch (_) {}
          window.location.assign('/?prenotazione=confermata');
        },
        onCancel(){ showBookingError('Pagamento annullato. Le date torneranno disponibili al termine del blocco temporaneo.'); },
        onError(error){ console.error(error); showBookingError(error.message||'Si è verificato un errore durante il pagamento.'); }
      }).render('#paypal-button-container');
      paypalRendered=true;
    }catch(error){ showBookingError(error.message); paypalLoading.hidden=true; }
  }
  function openBooking(){
    if(!arrival||!departure||stayTotal(arrival,departure)===null) return;
    const nights=nightsBetween(arrival,departure), pricing=stayPricing(arrival,departure);
    const discountLine=pricing.discount>0?`<div><span>Sconto ospite singolo (-10%)</span><strong>−${euro(pricing.discount)}</strong></div>`:'';
    document.getElementById('booking-recap').innerHTML=`<div><span>Check-in</span><strong>${formatDate(arrival)}</strong></div><div><span>Check-out</span><strong>${formatDate(departure)}</strong></div><div><span>${nights} ${nights===1?'notte':'notti'}</span><strong>${euro(pricing.base)}</strong></div>${discountLine}<div><span>Totale soggiorno</span><strong>${euro(pricing.total)}</strong></div><small>La tassa di soggiorno (€1 per persona per notte) si paga in contanti al check-in.</small>`;
    modal.hidden=false;
    document.body.classList.add('modal-open');
    preparePayPal();
  }
  function closeBooking(){ modal.hidden=true; document.body.classList.remove('modal-open'); }
  document.getElementById('open-booking').addEventListener('click',openBooking);
  document.querySelectorAll('[data-close-booking]').forEach(el=>el.addEventListener('click',closeBooking));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden) closeBooking();});
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(render,150);});

  function restoreBookingSuccess(){
    const params=new URLSearchParams(window.location.search);
    if(params.get('prenotazione')!=='confermata') return;
    let result=null;
    try { result=JSON.parse(sessionStorage.getItem('m306BookingSuccess')||'null'); } catch (_) {}
    if(!result) return;
    bookingForm.hidden=true;
    document.getElementById('booking-success').hidden=false;
    document.getElementById('booking-success-message').innerHTML=`Soggiorno dal <strong>${formatDate(result.start)}</strong> al <strong>${formatDate(result.end)}</strong>, totale <strong>${euro(Number(result.amount))}</strong>.<br>Codice: <strong>${result.bookingCode}</strong>`;
    modal.hidden=false;
    document.body.classList.add('modal-open');
    try { sessionStorage.removeItem('m306BookingSuccess'); } catch (_) {}
    history.replaceState({},document.title,window.location.pathname+window.location.hash);
  }
  restoreBookingSuccess();

  fetch('/api/availability',{headers:{'Accept':'application/json'}})
    .then(r=>{if(!r.ok) throw new Error('availability');return r.json();})
    .then(data=>{loadRanges(data.blockedRanges);loaded=true;document.getElementById('calendar-status').textContent='Calendario aggiornato';render();})
    .catch(()=>{loaded=false;document.getElementById('calendar-status').textContent='Disponibilità non caricata';monthsRoot.innerHTML='<p class="calendar-note">Il calendario non è temporaneamente disponibile. Contattaci direttamente su WhatsApp.</p>';updateSummary();});
  render();
})();


/* Versione 7.3: selettore multilingua e comportamento guida locale */
function toggleLanguageMenu(event) {
  if (event) event.stopPropagation();
  const switcher = document.querySelector('.language-switcher');
  if (!switcher) return false;
  const open = switcher.classList.toggle('is-open');
  const button = switcher.querySelector('.language-current');
  if (button) button.setAttribute('aria-expanded', String(open));
  return false;
}

function getCurrentLanguage() {
  const match = document.cookie.match(/(?:^|; )googtrans=\/it\/([^;]+)/);
  return match ? match[1] : 'it';
}

function setLanguageCookie(value) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `googtrans=${value};path=/;max-age=${maxAge};SameSite=Lax`;
  document.cookie = `googtrans=${value};path=/;domain=.marconi306.it;max-age=${maxAge};SameSite=Lax`;
}

function changeLanguage(lang) {
  const allowed = ['it', 'en', 'es', 'de', 'fr', 'ru', 'zh-CN', 'ja'];
  if (!allowed.includes(lang)) return;
  if (lang === 'it') {
    document.cookie = 'googtrans=;path=/;max-age=0';
    document.cookie = 'googtrans=;path=/;domain=.marconi306.it;max-age=0';
  } else {
    setLanguageCookie(`/it/${lang}`);
  }
  window.location.reload();
}

function updateLanguageUI() {
  const lang = getCurrentLanguage();
  document.documentElement.lang = lang;
  document.querySelectorAll('.language-code').forEach(el => { el.textContent = lang.toUpperCase(); });
  document.querySelectorAll('[data-lang]').forEach(el => el.classList.toggle('is-active', el.dataset.lang === lang));
  document.querySelectorAll('.mobile-language-switcher button').forEach(el => {
    el.classList.toggle('is-active', el.textContent.trim().toLowerCase() === lang);
  });
}

function syncLocalGuideDetails() {
  const categories = Array.from(document.querySelectorAll('.local-category'));
  if (!categories.length) return;
  if (window.matchMedia('(min-width: 641px)').matches) {
    categories.forEach(category => { category.open = true; });
  } else {
    const hasOpen = categories.some(category => category.open);
    if (!hasOpen) categories[0].open = true;
  }
}

function scrollToLocalCategory(category, behavior = 'smooth') {
  if (!category) return;
  const header = document.querySelector('.header');
  const mobileNav = document.querySelector('.local-mobile-nav');
  const headerHeight = header ? header.getBoundingClientRect().height : 0;
  const navHeight = mobileNav && getComputedStyle(mobileNav).display !== 'none'
    ? mobileNav.getBoundingClientRect().height : 0;
  const offset = headerHeight + navHeight + 10;
  const top = category.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: Math.max(0, top), behavior });
}

function updateLocalNavState(category) {
  document.querySelectorAll('[data-local-target]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.localTarget === category?.id);
  });
}

function openLocalCategory(category, shouldScroll = true) {
  if (!category) return;
  const isMobile = window.matchMedia('(max-width: 640px)').matches;
  if (isMobile) {
    document.querySelectorAll('.local-category').forEach(other => {
      if (other !== category) other.open = false;
    });
  }
  category.open = true;
  updateLocalNavState(category);
  if (shouldScroll) {
    requestAnimationFrame(() => requestAnimationFrame(() => scrollToLocalCategory(category)));
  }
}

function enableMobileAccordion() {
  document.querySelectorAll('.local-category').forEach(category => {
    const summary = category.querySelector('summary');
    if (summary) {
      summary.addEventListener('click', event => {
        if (!window.matchMedia('(max-width: 640px)').matches) return;
        event.preventDefault();
        if (category.open) {
          category.open = false;
          updateLocalNavState(null);
        } else {
          openLocalCategory(category, true);
        }
      });
    }
  });

  document.querySelectorAll('[data-local-target]').forEach(button => {
    button.addEventListener('click', () => {
      const category = document.getElementById(button.dataset.localTarget);
      openLocalCategory(category, true);
    });
  });

  const initiallyOpen = document.querySelector('.local-category[open]');
  updateLocalNavState(initiallyOpen);
}

document.addEventListener('click', event => {
  const switcher = document.querySelector('.language-switcher');
  if (switcher && !switcher.contains(event.target)) {
    switcher.classList.remove('is-open');
    const button = switcher.querySelector('.language-current');
    if (button) button.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  updateLanguageUI();
  syncLocalGuideDetails();
  enableMobileAccordion();
});
window.addEventListener('resize', syncLocalGuideDetails);
