
const $=(s,r=document)=>r.querySelector(s);
const gallery=["assets/img/camera-01.jpg", "assets/img/camera-02.jpg", "assets/img/camera-03.jpg", "assets/img/camera-04.jpg", "assets/img/camera-05.jpg", "assets/img/camera-06.jpg", "assets/img/camera-07.jpg", "assets/img/camera-08.jpg", "assets/img/camera-09.jpg", "assets/img/camera-10.jpg", "assets/img/camera-11.jpg", "assets/img/camera-12.jpg", "assets/img/camera-13.jpg", "assets/img/camera-14.jpg", "assets/img/camera-15.jpg", "assets/img/camera-16.jpg", "assets/img/camera-17.jpg"];
let lb=0;
function openLightbox(i){lb=i;$('#lb-img').src=gallery[lb];$('.lightbox').style.display='flex';}
function closeLightbox(){$('.lightbox').style.display='none';}
function stepLightbox(d){lb=(lb+d+gallery.length)%gallery.length;$('#lb-img').src=gallery[lb];}
window.openLightbox=openLightbox; window.closeLightbox=closeLightbox; window.stepLightbox=stepLightbox;
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox();if(e.key==='ArrowRight')stepLightbox(1);if(e.key==='ArrowLeft')stepLightbox(-1);});
$('#wa-request')?.addEventListener('click',e=>{e.preventDefault();const a=$('#arrival').value||'...';const d=$('#departure').value||'...';const g=$('#guests').value||'2';const msg=`Ciao, vorrei ricevere la migliore tariffa diretta per Marconi306 dal ${a} al ${d} per ${g} ospiti.`;window.open('https://wa.me/393278562974?text='+encodeURIComponent(msg),'_blank')});

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
