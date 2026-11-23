import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Menu, X, Dices, ArrowUpRight } from 'lucide-react';
import { getFavorites } from '../utils/storage';

const NAV_ITEMS = [
  { label: 'Início', to: '/', match: (path) => path === '/' },
  {
    label: 'Explorar',
    to: '/explorar',
    match: (path) => path === '/explorar' || path === '/explorer',
  },
  {
    label: 'Minha Lista',
    to: '/minha-lista',
    match: (path) => path === '/minha-lista',
    showFavBadge: true,
  },
];

export default function Header({ searchOpen = false, onOpenSurprise, onOpenSearch }) {
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
              id="studio-search-trigger"
              type="button"
              onClick={() => {
                closeMenu();
                onOpenSearch?.();
              }}
              aria-label="Buscar filmes e séries"
              className={`group flex items-center gap-2.5 h-10 px-3.5 sm:w-52 rounded-xl bg-white/[0.09] hover:bg-white/[0.15] backdrop-blur-xl border border-white/[0.14] text-xs text-white/65 hover:text-white transition-all duration-200 ${
                searchOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
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
      {/* MENU OVERLAY EDITORIAL — ZERO REDUNDÂNCIA                        */}
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
            <div className="container mx-auto px-5 sm:px-8 lg:px-14 py-9 sm:py-11">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                {/* Navegação principal: 1 destino real por link */}
                <nav
                  aria-label="Navegação principal"
                  className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-y-4 sm:gap-x-11"
                >
                  {NAV_ITEMS.map((item) => {
                    const active = item.match(location.pathname);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={closeMenu}
                        className={`group inline-flex items-center gap-3 text-2xl sm:text-4xl font-light tracking-tight transition-colors ${
                          active ? 'text-white font-normal' : 'text-white/60 hover:text-white'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full transition-all ${
                            active
                              ? 'bg-[#FE3131] scale-100'
                              : 'bg-white/20 scale-75 opacity-0 group-hover:opacity-100'
                          }`}
                        />
                        <span>{item.label}</span>
                        {item.showFavBadge && favCount > 0 && (
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white text-[#09090B] tracking-normal">
                            {favCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>

                {/* Ação de descoberta distinta: Roleta Surpreenda-me */}
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    onOpenSurprise?.();
                  }}
                  className="group w-full sm:w-auto lg:w-80 text-left p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.09] hover:border-white/25 transition-all flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/25 text-amber-300 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Dices className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <span className="block text-sm font-semibold text-white">
                        Surpreenda-me
                      </span>
                      <span className="block text-xs text-white/45 truncate">
                        Sorteie um título aclamado agora
                      </span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
                </button>
              </div>

              {/* Barra inferior discreta de identidade & atalhos */}
              <div className="mt-8 pt-5 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/35">
                <span>studio • Filmes, séries e streamings no Brasil</span>
                <div className="hidden sm:flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-white/[0.07] text-white/55 font-sans">
                      /
                    </kbd>
                    Buscar
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-white/[0.07] text-white/55 font-sans">
                      Esc
                    </kbd>
                    Fechar
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
