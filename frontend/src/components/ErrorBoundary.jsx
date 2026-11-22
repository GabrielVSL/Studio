import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('[studio] Erro inesperado capturado:', error?.message || error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-[#09090B] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#111115] border border-white/[0.1] rounded-2xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.08] text-white flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-medium mb-2">Algo deu errado</h1>
            <p className="text-sm text-white/55 mb-6">
              Ocorreu um erro inesperado ao renderizar esta página. Recarregue para continuar navegando.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-white/90 text-[#09090B] font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar Página
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
