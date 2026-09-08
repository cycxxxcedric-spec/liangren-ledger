import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import Ledger from './app/ledger';
import './app/globals.css';
createRoot(document.getElementById('root')!).render(<StrictMode><Ledger/></StrictMode>);

// Cache only application assets, never ledger data. Ledger stays in localStorage.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
 window.addEventListener('load',()=>{
  void navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{scope:import.meta.env.BASE_URL,updateViaCache:'none'}).catch(()=>{
   console.warn('Offline shell unavailable. Online ledger remains usable.');
  });
 });
}


// Size full-screen forms to the visible viewport, including the on-screen keyboard.
function updateVisibleViewport(){
 const viewport=window.visualViewport;
 document.documentElement.style.setProperty('--ledger-vv-height',`${viewport?.height??window.innerHeight}px`);
 document.documentElement.style.setProperty('--ledger-vv-top',`${viewport?.offsetTop??0}px`);
}
updateVisibleViewport();
window.visualViewport?.addEventListener('resize',updateVisibleViewport);
window.visualViewport?.addEventListener('scroll',updateVisibleViewport);
window.addEventListener('resize',updateVisibleViewport);
