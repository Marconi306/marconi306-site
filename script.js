
const $=(s,r=document)=>r.querySelector(s);
const gallery=["assets/img/camera-01.jpg", "assets/img/camera-02.jpg", "assets/img/camera-03.jpg", "assets/img/camera-04.jpg", "assets/img/camera-05.jpg", "assets/img/camera-06.jpg", "assets/img/camera-07.jpg", "assets/img/camera-08.jpg", "assets/img/camera-09.jpg", "assets/img/camera-10.jpg", "assets/img/camera-11.jpg", "assets/img/camera-12.jpg", "assets/img/camera-13.jpg", "assets/img/camera-14.jpg", "assets/img/camera-15.jpg", "assets/img/camera-16.jpg", "assets/img/camera-17.jpg"];
let lb=0;
function openLightbox(i){lb=i;$('#lb-img').src=gallery[lb];$('.lightbox').style.display='flex';}
function closeLightbox(){$('.lightbox').style.display='none';}
function stepLightbox(d){lb=(lb+d+gallery.length)%gallery.length;$('#lb-img').src=gallery[lb];}
window.openLightbox=openLightbox; window.closeLightbox=closeLightbox; window.stepLightbox=stepLightbox;
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox();if(e.key==='ArrowRight')stepLightbox(1);if(e.key==='ArrowLeft')stepLightbox(-1);});
$('#wa-request')?.addEventListener('click',e=>{e.preventDefault();const a=$('#arrival').value||'...';const d=$('#departure').value||'...';const g=$('#guests').value||'2';const msg=`Ciao, vorrei ricevere la migliore tariffa diretta per Marconi306 dal ${a} al ${d} per ${g} ospiti.`;window.open('https://wa.me/393278562974?text='+encodeURIComponent(msg),'_blank')});

// Menu mobile
const mobileToggle = document.querySelector('.mobile-menu-toggle');
const mobileMenu = document.querySelector('#mobile-menu');
function closeMobileMenu(){
  if(!mobileToggle || !mobileMenu) return;
  mobileToggle.classList.remove('is-open');
  mobileMenu.classList.remove('is-open');
  mobileToggle.setAttribute('aria-expanded','false');
  mobileToggle.setAttribute('aria-label','Apri il menu');
  document.body.classList.remove('menu-open');
}
mobileToggle?.addEventListener('click',()=>{
  const isOpen = mobileMenu.classList.toggle('is-open');
  mobileToggle.classList.toggle('is-open', isOpen);
  mobileToggle.setAttribute('aria-expanded', String(isOpen));
  mobileToggle.setAttribute('aria-label', isOpen ? 'Chiudi il menu' : 'Apri il menu');
  document.body.classList.toggle('menu-open', isOpen);
});
mobileMenu?.querySelectorAll('a').forEach(link=>link.addEventListener('click', closeMobileMenu));
window.addEventListener('resize',()=>{ if(window.innerWidth > 1000) closeMobileMenu(); });
