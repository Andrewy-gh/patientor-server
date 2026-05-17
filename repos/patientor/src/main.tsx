import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { DiagnosisProvider } from './contexts/DiagnosisContext.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <DiagnosisProvider>
    <App />
  </DiagnosisProvider>
);
