import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import Studio from '../app/studio/page';
import '../app/globals.css';

const Page=location.pathname.startsWith('/studio')?Studio:Home;
createRoot(document.getElementById('root')!).render(<StrictMode><Page/></StrictMode>);
