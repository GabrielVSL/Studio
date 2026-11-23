import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-[#09090B] border-t border-white/[0.07] mt-16">
      <div className="container mx-auto px-5 sm:px-8 lg:px-14 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <Link to="/" className="inline-flex items-center hover:opacity-85 transition-opacity">
              <img
                src="/logo-studio.png"
                alt="studio"
                className="h-6 w-auto object-contain select-none"
              />
            </Link>
            <p className="text-xs text-white/40 mt-2">
              Guia de filmes, séries e streamings no Brasil
            </p>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-white/55">
            <Link to="/" className="hover:text-white transition-colors">
              Início
            </Link>
            <Link to="/explorar" className="hover:text-white transition-colors">
              Explorar
            </Link>
            <Link to="/minha-lista" className="hover:text-white transition-colors">
              Minha Lista
            </Link>
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/35">
          <p>© {new Date().getFullYear()} studio. Todos os direitos reservados.</p>
          <p>
            Dados de catálogo e streamings via{' '}
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/55 hover:text-white underline underline-offset-2 transition-colors"
            >
              TMDB
            </a>{' '}
            & JustWatch.
          </p>
        </div>
      </div>
    </footer>
  );
}
