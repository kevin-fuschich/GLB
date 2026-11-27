/* Native button interaction supports touch, mouse, Enter and Space. */
for(const button of document.querySelectorAll('.fieldstock-driver .fs-flipper')){
  const cue=document.createElement('span');cue.className='fs-flip-cue';cue.textContent='Flip';cue.setAttribute('aria-hidden','true');button.append(cue);
  const name=button.closest('.fieldstock-driver').querySelector('.fs-name').textContent;
  const edition=button.closest('.fs-card').dataset.edition || 'Road to Tijuana';
  button.addEventListener('click',()=>{
    const flipped=button.classList.toggle('is-flipped');
    button.setAttribute('aria-pressed',String(flipped));
    button.setAttribute('aria-label',`${name} ${edition} card. ${flipped?'Back':'Front'} shown. Activate to flip.`);
    button.querySelector('.fs-front').setAttribute('aria-hidden',String(flipped));
    button.querySelector('.fs-back').setAttribute('aria-hidden',String(!flipped));
  });
}
