import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import StarApp from '../app/star-app';
import '../app/globals.css';
createRoot(document.getElementById('root')!).render(<StrictMode><StarApp/></StrictMode>);
