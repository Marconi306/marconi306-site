
const $=(s,r=document)=>r.querySelector(s);
const gallery=["assets/img/camera-01.jpg", "assets/img/camera-02.jpg", "assets/img/camera-03.jpg", "assets/img/camera-04.jpg", "assets/img/camera-05.jpg", "assets/img/camera-06.jpg", "assets/img/camera-07.jpg", "assets/img/camera-08.jpg", "assets/img/camera-09.jpg", "assets/img/camera-10.jpg", "assets/img/camera-11.jpg", "assets/img/camera-12.jpg", "assets/img/camera-13.jpg", "assets/img/camera-14.jpg", "assets/img/camera-15.jpg", "assets/img/camera-16.jpg", "assets/img/camera-17.jpg"];
let lb=0;
function openLightbox(i){lb=i;$('#lb-img').src=gallery[lb];$('.lightbox').style.display='flex';}
function closeLightbox(){$('.lightbox').style.display='none';}
function stepLightbox(d){lb=(lb+d+gallery.length)%gallery.length;$('#lb-img').src=gallery[lb];}
window.openLightbox=openLightbox; window.closeLightbox=closeLightbox; window.stepLightbox=stepLightbox;
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLightbox();if(e.key==='ArrowRight')stepLightbox(1);if(e.key==='ArrowLeft')stepLightbox(-1);});
$('#wa-request')?.addEventListener('click',e=>{e.preventDefault();const a=$('#arrival').value||'...';const d=$('#departure').value||'...';const g=$('#guests').value||'2';const msg=`Ciao, vorrei prenotare Marconi306 dal ${a} al ${d} per ${g} ospiti.`;window.open('https://wa.me/393278562974?text='+encodeURIComponent(msg),'_blank')});


const revealItems = document.querySelectorAll('.section, .card, .place-card, .comfort, .photo');
if ('IntersectionObserver' in window) {
  revealItems.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealItems.forEach(el => io.observe(el));
}
