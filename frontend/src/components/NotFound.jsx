import React from 'react';
import { Link } from 'react-router-dom';
import { Clapperboard, Home, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#09090B] pt-28 pb-20 px-4 flex items-center justify-center">
      <div className="max-w-lg w-full text-center bg-white/[0.03] border border-white/[0.09] rounded-2xl p-10 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.08] text-white flex items-center justify-center mx-auto mb-6">
          <Clapperboard className="w-8 h-8" />
        </div>
        <p className="text-xs font-medium uppercase tracking-widest text-white/45 mb-2">
          Erro 404
        </p>
        <h1 className="text-3xl sm:text-4xl font-medium text-white tracking-tight mb-3">
          Página não encontrada
        </h1>
        <p className="text-sm text-white/50 mb-8">
          O link que você tentou acessar não existe ou foi removido do catálogo.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-white hover:bg-white/90 text-[#09090B] font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            <Home className="w-4 h-4" />
            Ir para o Início
          </Link>
          <Link
            to="/explorar"
            className="inline-flex items-center gap-2 bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/[0.14] font-medium text-sm px-6 py-3 rounded-xl transition-colors"
          >
            <Compass className="w-4 h-4" />
            Explorar Catálogo
          </Link>
        </div>
      </div>
    </main>
  );
}
