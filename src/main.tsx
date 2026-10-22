import { createRoot } from 'react-dom/client';
import App from './App';
import IconLab from './icons/IconLab';
import LcdLab from './lcd/LcdLab';
import CompositionLab from './composition/CompositionLab';

const page = window.location.pathname.replace(/\/$/, '');
if (page === '/icons') document.title = 'Pixel Icons — Indie Go Punk';
if (page === '/lcd') document.title = 'Procedural LCD — Indie Go Punk';
if (page === '/compose') document.title = 'Composition Lab — Indie Go Punk';
createRoot(document.getElementById('root')!).render(page === '/compose' ? <CompositionLab /> : page === '/lcd' ? <LcdLab /> : page === '/icons' ? <IconLab /> : <App />);
