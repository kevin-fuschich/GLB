/* Native button interaction supports touch, mouse, Enter and Space. */
for(const button of document.querySelectorAll('.donk-print-card .fs-flipper')){
  const name=button.closest('.fieldstock-driver').querySelector('.fs-name').textContent;
  button.addEventListener('click',()=>{
    const flipped=button.classList.toggle('is-flipped');
    button.setAttribute('aria-pressed',String(flipped));
    button.setAttribute('aria-label',`${name} driver card. ${flipped?'Back':'Front'} shown. Activate to flip.`);
    button.querySelector('.fs-front').setAttribute('aria-hidden',String(flipped));
    button.querySelector('.fs-back').setAttribute('aria-hidden',String(!flipped));
  });
}
