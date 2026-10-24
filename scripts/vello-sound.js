/* VELLO's original stereo sound study. Audio starts only from the play control. */
((root) => {
  'use strict';
  const DURATION = 15;
  const EVENTS = [
    {time:0.45,kind:'note',frequency:293.665,pan:-0.85,ring:0},
    {time:1.2,kind:'note',frequency:440,pan:0,ring:1},
    {time:1.95,kind:'note',frequency:587.33,pan:0.85,ring:2},
    ...[-0.85,0,0.85,0.85,0,-0.85].flatMap((pan,i) => [
      {time:4+i*0.9,kind:'note',frequency:[293.665,440,587.33][i%3],pan,ring:pan<0?0:pan>0?2:1},
      {time:4.3+i*0.9,kind:'clap',pan,ring:pan<0?0:pan>0?2:1}
    ]),
    {time:10.8,kind:'note',frequency:293.665,pan:-0.65,ring:0},
    {time:11.5,kind:'note',frequency:440,pan:0,ring:1},
    {time:12.2,kind:'note',frequency:587.33,pan:0.65,ring:2},
    {time:13,kind:'note',frequency:146.8325,pan:-0.35,ring:0},
    {time:13,kind:'note',frequency:293.665,pan:0,ring:1},
    {time:13,kind:'note',frequency:440,pan:0.35,ring:2}
  ].sort((a,b) => a.time-b.time);

  // The same deterministic waveform is used by the player and the audio checks.
  function render(sampleRate) {
    const length = Math.ceil(sampleRate * DURATION);
    const left = new Float32Array(length), right = new Float32Array(length);
    let seed = 1631;
    const noise = () => {seed = (Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
    for (const event of EVENTS) {
      const duration = event.kind === 'note' ? 1.75 : 0.19;
      for (const [delay,level] of [[0,1],[0.17,0.18],[0.34,0.07]]) {
        const pan = delay ? -event.pan * 0.65 : event.pan;
        const gainL = Math.cos((pan+1)*Math.PI/4), gainR = Math.sin((pan+1)*Math.PI/4);
        const start = Math.round((event.time+delay)*sampleRate);
        let previous = 0;
        for(let i=0;i<Math.round(duration*sampleRate) && start+i<length;i++) {
          const t = i/sampleRate;
          let value;
          if(event.kind === 'note') {
            const phase = 2*Math.PI*event.frequency*t;
            const envelope = (1-Math.exp(-t*180))*Math.exp(-t*3.8);
            value = 0.19*envelope*(Math.sin(phase)+0.28*Math.sin(phase*2.002)*Math.exp(-t*2)+0.1*Math.sin(phase*3.01)*Math.exp(-t*4));
          } else {
            const n = noise(), high = n-previous*0.88; previous=n;
            const envelope = (1-Math.exp(-t*1100))*Math.exp(-t*29);
            const flutter = 0.62+0.38*Math.cos(2*Math.PI*53*t)**2;
            value = 0.115*high*envelope*flutter;
          }
          // Fade the study to silence at its exact endpoint.
          const tail = Math.min(1,Math.max(0,(DURATION-(start+i)/sampleRate)/0.45));
          left[start+i] += value*gainL*level*tail;
          right[start+i] += value*gainR*level*tail;
        }
      }
    }
    let peak=0;
    for(let i=0;i<length;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
    if(peak)for(let i=0;i<length;i++){left[i]*=0.72/peak;right[i]*=0.72/peak;}
    return [left,right];
  }
  if(typeof module === 'object' && module.exports)module.exports={DURATION,EVENTS,render};
  if(!root.document)return;
  const host=root.document.getElementById('vello-sound');
  if(!host)return;
  const audio=host.querySelector('[data-sound-audio]');
  const status=host.querySelector('[data-sound-status]');
  const rings=[...host.querySelectorAll('[data-sound-ring]')];
  let frame=0;
  const lightsOff=()=>{root.cancelAnimationFrame(frame);rings.forEach(r=>r.style.setProperty('--pulse','0'));};
  function draw(){
    const time=audio.currentTime;
    const phase=time<3.6?'Three notes · Left, center, right.':time<10.3?'The response · Percussion follows the circuit.':'The return · Three notes settle together.';
    if(status.textContent!==phase)status.textContent=phase;
    rings.forEach((ring,index)=>{
      let pulse=0;
      for(const event of EVENTS){const age=time-event.time;if(event.ring===index&&age>=0&&age<0.85)pulse=Math.max(pulse,Math.exp(-age*5));}
      ring.style.setProperty('--pulse',pulse.toFixed(3));
    });
    if(!audio.paused&&!audio.ended)frame=root.requestAnimationFrame(draw);
  }
  audio.addEventListener('play',()=>{host.classList.add('is-playing');lightsOff();draw();});
  audio.addEventListener('pause',()=>{lightsOff();host.classList.remove('is-playing');if(!audio.ended)status.textContent='Paused. Press play to continue.';});
  audio.addEventListener('ended',()=>{lightsOff();host.classList.remove('is-playing');status.textContent='The circuit is complete. Play again to hear it travel.';});
  audio.addEventListener('seeking',lightsOff);
  audio.addEventListener('seeked',()=>{if(!audio.paused)draw();});
  audio.addEventListener('error',()=>{lightsOff();status.textContent='The audio could not load here. Use the direct audio link below to open it in your player.';});
  root.document.addEventListener('visibilitychange',()=>{if(root.document.hidden&&!audio.paused)audio.pause();});
  root.addEventListener('pagehide',()=>{audio.pause();lightsOff();});
})(typeof window === 'undefined' ? globalThis : window);
