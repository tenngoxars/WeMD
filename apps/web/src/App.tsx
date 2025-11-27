import { Toaster } from 'react-hot-toast';
import { Header } from './components/Header/Header';
import { MarkdownEditor } from './components/Editor/MarkdownEditor';
import { MarkdownPreview } from './components/Preview/MarkdownPreview';
import './styles/global.css';
import './App.css';

function App() {
  return (
    <div className="app">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#fff',
            color: '#333',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            borderRadius: '8px',
            padding: '12px 16px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
        }}
      />
      <Header />
      <main className="app-main">
        <div className="editor-pane">
          <MarkdownEditor />
        </div>
        <div className="preview-pane">
          <MarkdownPreview />
        </div>
      </main>
    </div>
  );
}

export default App;
