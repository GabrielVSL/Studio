import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './components/Home';
import MovieDetails from './components/MovieDetails';
import Explorer from './components/Explorer';
import MyList from './components/MyList';
import NotFound from './components/NotFound';
import SurpriseModal from './components/SurpriseModal';
import SearchModal from './components/SearchModal';
import { ToastProvider } from './components/ToastContext';

function App() {
  const [surpriseOpen, setSurpriseOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Atalho global Ctrl+K / Cmd+K (ou "/") para busca rápida
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
        return;
      }

      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
      ) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router>
          <div className="min-h-screen flex flex-col bg-[#09090B] text-white">
            <Header
              onOpenSurprise={() => setSurpriseOpen(true)}
              onOpenSearch={() => setSearchOpen(true)}
            />

            <div className="flex-1">
              <Routes>
                <Route path="/" element={<Home onOpenSurprise={() => setSurpriseOpen(true)} />} />
                <Route path="/explorar" element={<Explorer />} />
                <Route path="/explorer" element={<Explorer />} />
                <Route path="/minha-lista" element={<MyList />} />

                {/* Rotas unificadas Filmes + Séries */}
                <Route path="/filme/:id" element={<MovieDetails mediaType="movie" />} />
                <Route path="/serie/:id" element={<MovieDetails mediaType="tv" />} />

                {/* Rotas legadas preservadas para compatibilidade */}
                <Route path="/series/:id" element={<MovieDetails mediaType="tv" />} />
                <Route path="/detalhes/:id" element={<MovieDetails mediaType="tv" />} />

                {/* Página 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>

            <Footer />

            <SearchModal
              isOpen={searchOpen}
              onClose={() => setSearchOpen(false)}
            />

            <SurpriseModal
              isOpen={surpriseOpen}
              onClose={() => setSurpriseOpen(false)}
            />
          </div>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
