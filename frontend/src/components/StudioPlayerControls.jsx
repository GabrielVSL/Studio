import React, { useState } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Subtitles,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Gauge,
  SlidersHorizontal,
  Check,
} from 'lucide-react';

const formatTime = (secs) => {
  if (!Number.isFinite(secs) || secs < 0) return '0:00';
  const total = Math.floor(secs);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const FALLBACK_CAPTION_LANGS = [
  { code: 'pt-BR', label: 'Português (Brasil)', short: 'PT-BR' },
  { code: 'en', label: 'Inglês', short: 'EN' },
  { code: 'es', label: 'Espanhol', short: 'ES' },
];

const QUALITIES = [
  { value: 'default', label: 'Automática', badge: 'Auto' },
  { value: 'hd2160', label: '2160p 4K', badge: '4K' },
  { value: 'hd1440', label: '1440p QHD', badge: '1440p' },
  { value: 'hd1080', label: '1080p Full HD', badge: '1080p' },
  { value: 'hd720', label: '720p HD', badge: '720p' },
  { value: 'large', label: '480p SD', badge: '480p' },
];

const RATES = [0.75, 1, 1.25, 1.5];

export default function StudioPlayerControls({
  title = '',
  isPlaying = false,
  currentTime = 0,
  duration = 0,
  isMuted = false,
  volume = 100,
  captionLang = 'off',
  captionOptions = null,
  captionsLoaded = false,
  quality = 'default',
  availableQualities = null,
  playbackRate = 1,
  isFullscreen = false,
  visible = true,
  onClose,
  onTogglePlay,
  onSeek,
  onSkip,
  onToggleMute,
  onVolumeChange,
  onCaptionLangChange,
  onQualityChange,
  onRateChange,
  onToggleFullscreen,
  onActivity,
}) {
  // Apenas um menu aberto por vez: 'captions' | 'quality' | 'speed' | null
  const [openMenu, setOpenMenu] = useState(null);

  const toggleMenu = (name) => {
    setOpenMenu((curr) => (curr === name ? null : name));
    onActivity?.();
  };

  const progressPct =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const resolvedTracks = captionsLoaded
    ? captionOptions || []
    : captionOptions && captionOptions.length > 0
      ? captionOptions
      : FALLBACK_CAPTION_LANGS;

  const captionMenuItems = [
    { code: 'off', label: 'Desativada', short: '' },
    ...resolvedTracks,
  ];

  const activeCaptionObj =
    captionMenuItems.find((c) => c.code === captionLang) || captionMenuItems[0];

  const visibleQualities =
    Array.isArray(availableQualities) && availableQualities.length > 0
      ? QUALITIES.filter((q) => q.value === 'default' || availableQualities.includes(q.value))
      : QUALITIES.filter((q) => ['default', 'hd1080', 'hd720', 'large'].includes(q.value));

  const activeQualityObj =
    visibleQualities.find((q) => q.value === quality) || visibleQualities[0];

  return (
    <div
      onMouseMove={onActivity}
      onTouchStart={onActivity}
      className="absolute inset-0 z-20 flex flex-col justify-between select-none"
    >
      {/* BARRA SUPERIOR ULTRA-LIMPA (SEM SELETORES POLUÍDOS) */}
      <div
        className={`px-5 sm:px-8 lg:px-14 pt-6 pb-10 bg-gradient-to-b from-black/85 via-black/35 to-transparent flex items-center justify-between gap-4 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(null);
              onClose?.();
            }}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-white/95 hover:text-[#09090B] px-4 py-2 rounded-xl bg-black/55 hover:bg-white backdrop-blur-xl border border-white/15 transition-all flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="min-w-0 hidden sm:block">
            <p className="text-[10px] uppercase tracking-widest text-white/45">
              studio player
            </p>
            <h3 className="text-sm md:text-base font-medium text-white truncate">
              {title}
            </h3>
          </div>
        </div>
      </div>

      {/* ÁREA CENTRAL CLICÁVEL (CLICK = PLAY/PAUSE, DUPLO CLICK = FULLSCREEN) */}
      <div
        onClick={() => {
          if (openMenu) {
            setOpenMenu(null);
            return;
          }
          onTogglePlay?.();
          onActivity?.();
        }}
        onDoubleClick={() => onToggleFullscreen?.()}
        className="flex-1 flex items-center justify-center cursor-pointer"
      >
        {!isPlaying && (
          <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/25 text-white flex items-center justify-center shadow-2xl animate-scale-in">
            <Play className="w-9 h-9 fill-current ml-1" />
          </div>
        )}
      </div>

      {/* BARRA INFERIOR DE CONTROLES DO STUDIO */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`px-5 sm:px-8 lg:px-14 pt-12 pb-6 bg-gradient-to-t from-black/90 via-black/55 to-transparent space-y-3.5 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Linha do tempo interativa */}
        <div className="relative group/bar flex items-center h-4">
          <div className="w-full h-1 group-hover/bar:h-1.5 bg-white/20 rounded-full overflow-hidden transition-all">
            <div
              style={{ width: `${progressPct}%` }}
              className="h-full bg-white rounded-full transition-[width] duration-150"
            />
          </div>
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.5"
            value={Math.min(currentTime, duration || 100)}
            onChange={(e) => onSeek?.(Number(e.target.value))}
            aria-label="Linha do tempo do trailer"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Botões de controle */}
        <div className="flex items-center justify-between gap-3">
          {/* Esquerda: Play, -10s, +10s, Volume, Tempo */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
              className="w-10 h-10 rounded-xl bg-white hover:bg-white/90 text-[#09090B] flex items-center justify-center transition-transform active:scale-95"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onSkip?.(-10)}
              aria-label="Voltar 10 segundos"
              title="-10s"
              className="w-9 h-9 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] text-white/85 hover:text-white flex items-center justify-center transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onSkip?.(10)}
              aria-label="Avançar 10 segundos"
              title="+10s"
              className="w-9 h-9 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] text-white/85 hover:text-white flex items-center justify-center transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 ml-1">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={isMuted ? 'Ativar som' : 'Silenciar'}
                className="w-9 h-9 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] text-white/85 hover:text-white flex items-center justify-center transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange?.(Number(e.target.value))}
                aria-label="Volume"
                className="hidden sm:block w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white"
              />
            </div>

            <span className="text-xs font-medium text-white/70 tabular-nums ml-1">
              {formatTime(currentTime)}
              {duration > 0 ? ` / ${formatTime(duration)}` : ''}
            </span>
          </div>

          {/* Direita: Legendas & Idioma, Qualidade, Velocidade, Tela Cheia */}
          <div className="flex items-center gap-2 relative">
            {/* Legendas + Idioma */}
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleMenu('captions')}
                aria-label="Legendas e idioma"
                className={`h-9 px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-all ${
                  captionLang !== 'off'
                    ? 'bg-white text-[#09090B] border-white font-semibold'
                    : 'bg-white/[0.08] hover:bg-white/[0.16] text-white/85 border-white/10'
                }`}
              >
                <Subtitles className="w-4 h-4" />
                <span className="hidden md:inline">
                  {activeCaptionObj.short
                    ? `Legendas · ${activeCaptionObj.short}`
                    : 'Legendas'}
                </span>
              </button>

              {openMenu === 'captions' && (
                <div className="absolute right-0 bottom-full mb-2.5 w-56 bg-[#111115]/96 backdrop-blur-2xl border border-white/15 rounded-2xl overflow-hidden py-1.5 shadow-2xl animate-fade-in">
                  <p className="px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                    Legendas (CC)
                  </p>
                  <div className="max-h-56 overflow-y-auto">
                    {captionMenuItems.map((lang) => {
                      const active = captionLang === lang.code;
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => {
                            onCaptionLangChange?.(lang.code);
                            setOpenMenu(null);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center justify-between gap-2 transition-colors ${
                            active
                              ? 'bg-white text-[#09090B] font-semibold'
                              : 'text-white/80 hover:bg-white/[0.08]'
                          }`}
                        >
                          <span className="truncate">{lang.label}</span>
                          {active && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  {captionsLoaded && resolvedTracks.length === 0 ? (
                    <p className="px-3.5 pt-2 pb-1.5 mt-1 border-t border-white/10 text-[10px] leading-relaxed text-white/45">
                      Este trailer não oferece legendas opcionais no YouTube.
                    </p>
                  ) : (
                    <p className="px-3.5 pt-2 pb-1.5 mt-1 border-t border-white/10 text-[10px] leading-relaxed text-white/40">
                      Legendas gravadas no vídeo original não podem ser removidas.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Qualidade */}
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleMenu('quality')}
                aria-label="Qualidade do vídeo"
                className={`h-9 px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-all ${
                  openMenu === 'quality'
                    ? 'bg-white text-[#09090B] border-white font-semibold'
                    : 'bg-white/[0.08] hover:bg-white/[0.16] text-white/85 border-white/10'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{activeQualityObj.badge}</span>
              </button>

              {openMenu === 'quality' && (
                <div className="absolute right-0 bottom-full mb-2.5 w-44 bg-[#111115]/96 backdrop-blur-2xl border border-white/15 rounded-2xl overflow-hidden py-1.5 shadow-2xl animate-fade-in">
                  <p className="px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                    Qualidade
                  </p>
                  {visibleQualities.map((q) => {
                    const active = quality === q.value;
                    return (
                      <button
                        key={q.value}
                        type="button"
                        onClick={() => {
                          onQualityChange?.(q.value);
                          setOpenMenu(null);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center justify-between transition-colors ${
                          active
                            ? 'bg-white text-[#09090B] font-semibold'
                            : 'text-white/80 hover:bg-white/[0.08]'
                        }`}
                      >
                        <span>{q.label}</span>
                        {active && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Velocidade */}
            <div className="relative">
              <button
                type="button"
                onClick={() => toggleMenu('speed')}
                aria-label="Velocidade de reprodução"
                className={`h-9 px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-all ${
                  openMenu === 'speed'
                    ? 'bg-white text-[#09090B] border-white font-semibold'
                    : 'bg-white/[0.08] hover:bg-white/[0.16] text-white/85 border-white/10'
                }`}
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>{playbackRate}x</span>
              </button>

              {openMenu === 'speed' && (
                <div className="absolute right-0 bottom-full mb-2.5 w-32 bg-[#111115]/96 backdrop-blur-2xl border border-white/15 rounded-2xl overflow-hidden py-1.5 shadow-2xl animate-fade-in">
                  <p className="px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                    Velocidade
                  </p>
                  {RATES.map((r) => {
                    const active = playbackRate === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          onRateChange?.(r);
                          setOpenMenu(null);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center justify-between transition-colors ${
                          active
                            ? 'bg-white text-[#09090B] font-semibold'
                            : 'text-white/80 hover:bg-white/[0.08]'
                        }`}
                      >
                        <span>{r === 1 ? 'Normal (1x)' : `${r}x`}</span>
                        {active && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tela Cheia */}
            <button
              type="button"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              aria-label="Tela cheia"
              className="w-9 h-9 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] border border-white/10 text-white/85 hover:text-white flex items-center justify-center transition-colors"
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
