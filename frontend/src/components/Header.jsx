import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Search,
  Menu,
  X,
  ArrowRight,
  Dices,
  Flame,
  Rocket,
  VenetianMask,
  Laugh,
  Eye,
  Skull,
  Sparkles,
  Heart,
} from 'lucide-react';
import { getFavorites } from '../utils/storage';

const MENU_GENRES = [
  { id: 28, name: 'Ação', icon: Flame },
  { id: 878, name: 'Ficção', icon: Rocket },
  { id: 18, name: 'Drama', icon: VenetianMask },
  { id: 35, name: 'Comédia', icon: Laugh },
  { id: 53, name: 'Suspense', icon: Eye },
  { id: 27, name: 'Terror', icon: Skull },
  { id: 16, name: 'Animação', icon: Sparkles },
  { id: 10749, name: 'Romance', icon: Heart },
];

export default function Header({ onOpenSurprise, onOpenSearch }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onPlayerToggle = (e) => {
      const open = Boolean(e.detail?.open);
      setPlayerOpen(open);
      if (open) setMenuOpen(false);
    };
    window.addEventListener('studio:player-open', onPlayerToggle);
    return () => window.removeEventListener('studio:player-open', onPlayerToggle);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 36);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const syncFavs = () => setFavCount(getFavorites().length);
    syncFavs();
    window.addEventListener('bhflix:favorites-updated', syncFavs);
    window.addEventListener('storage', syncFavs);
    return () => {
      window.removeEventListener('bhflix:favorites-updated', syncFavs);
      window.removeEventListener('storage', syncFavs);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      {/* ================================================================ */}
      {/* TOP BAR ULTRA-LIMPA (ESTILO MON)                                 */}
      {/* ================================================================ */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          playerOpen
            ? 'opacity-0 pointer-events-none'
            : scrolled || menuOpen
              ? 'bg-[#09090B]/88 backdrop-blur-2xl border-b border-white/[0.07]'
              : 'bg-gradient-to-b from-black/55 via-black/20 to-transparent'
        }`}
      >
        <div className="container mx-auto px-5 sm:px-8 lg:px-14 h-20 flex items-center justify-between gap-4">
          {/* Esquerda: Logo studio transparente */}
          <Link
            to="/"
            onClick={closeMenu}
            className="inline-flex items-center hover:opacity-85 transition-opacity"
            aria-label="studio — Início"
          >
            <img
              src="/logo-studio.png"
              alt="studio"
              className="h-6 sm:h-7 w-auto object-contain select-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]"
            />
          </Link>

          {/* Direita: Busca translúcida discreta + Botão quadrado branco Menu */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                closeMenu();
                onOpenSearch?.();
              }}
              aria-label="Buscar filmes e séries"
              className="group flex items-center gap-2.5 h-10 px-3.5 sm:w-52 rounded-xl bg-white/[0.09] hover:bg-white/[0.15] backdrop-blur-xl border border-white/[0.14] text-xs text-white/65 hover:text-white transition-all"
            >
              <Search className="w-4 h-4 text-white/70 flex-shrink-0" />
              <span className="hidden sm:inline flex-1 text-left">Buscar</span>
              <kbd className="hidden md:inline text-[10px] px-1.5 py-0.5 rounded bg-black/30 text-white/45">
                /
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menuOpen}
              className="w-10 h-10 rounded-xl bg-white hover:bg-white/90 text-[#09090B] flex items-center justify-center shadow-lg shadow-black/30 transition-transform active:scale-95"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ================================================================ */}
      {/* MENU OVERLAY EDITORIAL (ESTILO MON 00:19–00:21)                  */}
      {/* ================================================================ */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/65 backdrop-blur-md pt-20 animate-fade-in"
          onClick={closeMenu}
        >
          <div
            className="bg-[#0B0B0E]/98 border-b border-white/[0.09] shadow-[0_30px_80px_rgba(0,0,0,0.9)] animate-mon-menu"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="container mx-auto px-5 sm:px-8 lg:px-14 py-9 sm:py-12 space-y-10">
              {/* Linha principal: Tipografia editorial grande + coluna secundária */}
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
                <nav className="flex flex-wrap items-center gap-x-9 gap-y-4">
                  {[
                    { label: 'Início', to: '/' },
                    { label: 'Em Alta', to: '/explorar?tipo=movie' },
                    {
                      label: 'Melhores Avaliados',
                      to: '/explorar?tipo=movie&sort=vote_average.desc',
                    },
                    { label: 'Populares', to: '/explorar?tipo=tv' },
                  ].map((item) => {
                    const active =
                      item.to === '/' && location.pathname === '/';
                    return (
                      <Link
                        key={item.label}
                        to={item.to}
                        onClick={closeMenu}
                        className={`text-2xl sm:text-4xl font-light tracking-tight transition-colors ${
                          active
                            ? 'text-white'
                            : 'text-white/75 hover:text-white'
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>

                <div className="flex flex-wrap lg:flex-col gap-x-6 gap-y-2.5 lg:min-w-[190px] text-sm">
                  <Link
                    to="/explorar?tipo=movie"
                    onClick={closeMenu}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    Filmes
                  </Link>
                  <Link
                    to="/explorar?tipo=tv"
                    onClick={closeMenu}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    Séries
                  </Link>
                  <Link
                    to="/explorar"
                    onClick={closeMenu}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    Onde Assistir (BR)
                  </Link>
                  <Link
                    to="/minha-lista"
                    onClick={closeMenu}
                    className="text-white/60 hover:text-white transition-colors inline-flex items-center gap-2"
                  >
                    Minha Lista
                    {favCount > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-[#09090B]">
                        {favCount}
                      </span>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu();
                      onOpenSurprise?.();
                    }}
                    className="text-white/80 hover:text-white transition-colors inline-flex items-center gap-1.5 text-left font-medium"
                  >
                    <Dices className="w-4 h-4 text-amber-400" />
                    Surpreenda-me
                  </button>
                </div>
              </div>

              {/* Faixa inferior de Gêneros (como no vídeo 00:19) */}
              <div className="pt-6 border-t border-white/[0.07]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-medium uppercase tracking-widest text-white/45">
                    Gêneros de Filmes
                  </span>
                  <Link
                    to="/explorar?tipo=movie"
                    onClick={closeMenu}
                    className="text-xs font-medium text-white/60 hover:text-white inline-flex items-center gap-1 transition-colors"
                  >
                    Explorar tudo
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="flex overflow-x-auto gap-3 pb-1 hide-scrollbar">
                  {MENU_GENRES.map((g) => {
                    const Icon = g.icon;
                    return (
                      <Link
                        key={g.id}
                        to={`/explorar?tipo=movie&genero=${g.id}`}
                        onClick={closeMenu}
                        className="group relative flex-shrink-0 w-36 sm:w-44 h-20 rounded-xl overflow-hidden bg-[#121216] hover:bg-white/[0.08] border border-white/[0.09] hover:border-white/30 p-3.5 flex flex-col justify-between transition-all"
                      >
                        <Icon className="w-4 h-4 text-white/45 group-hover:text-white transition-colors" />
                        <span className="relative z-10 text-sm font-medium text-white/90 group-hover:text-white">
                          {g.name}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
