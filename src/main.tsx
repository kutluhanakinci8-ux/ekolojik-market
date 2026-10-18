import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { redirectToCanonicalWwwHost } from './config/canonicalSite';
import App from './App';
import { StoreProvider } from './store/StoreProvider';
import './styles/global.css';
import './styles/posta-yazisma.css';
import './styles/posta-klasor.css';
import './styles/landing.css';

redirectToCanonicalWwwHost();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>,
);
