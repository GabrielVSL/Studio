import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Play, ArrowLeft, ExternalLink, Film, Loader2 } from 'lucide-react';
import { getBackdropUrl, getMediaVideos } from '../services/api';
import { isValidYouTubeKey } from '../utils/security';
import {
  loadYouTubeIframeApi,
  extractCaptionOptions,
  applyCaptionSelection,
} from '../utils/youtubeApi';
import StudioPlayerControls from './StudioPlayerControls';

const YT_ORIGINS = new Set([
  'https://www.youtube-nocookie.com',
  'https://www.youtube.com',
]);

const notifyPlayerOverlay = (open) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studio:player-open', { detail: { open } }));
  }
};

/**
 * ÚNICA FONTE DE VERDADE DO TRAILER:
 * Um único <iframe> persistente começa tocando silenciosamente na prévia (canto da Hero/Detalhes),
 * expande suavemente até 100vw × 100vh + entra em tela cheia nativa após a animação,
 * e ao voltar recolhe para o cantinho continuando exatamente de onde parou!
 */
const TrailerPreviewCard = forwardRef(function TrailerPreviewCard(
  {
    mediaId,
    mediaType = 'tv',
    title = '',
    backdropPath = '',
    initialTrailerKey = null,
    preloadedVideos = null,
    paused = false,
    onExpandChange,
    className = '',
  },
  ref
) {
  const [resolvedKey, setResolvedKey] = useState(
    isValidYouTubeKey(initialTrailerKey) ? initialTrailerKey : null
  );
  const [loadingVideos, setLoadingVideos] = useState(false);

  // 'mini' | 'entering' | 'expanded' | 'closing'
  const [mode, setMode] = useState('mini');
  const [anchorRect, setAnchorRect] = useState(null);

  // Estado sincronizado do player
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(100);
  const [captionLang, setCaptionLang] = useState('off');
  const [captionOptions, setCaptionOptions] = useState([]);
  const [captionsLoaded, setCaptionsLoaded] = useState(false);
  const [quality, setQuality] = useState('default');
  const [availableQualities, setAvailableQualities] = useState(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const rawUid = useId();
  const iframeDomId = `yt-preview-${rawUid.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const slotRef = useRef(null);
  const playerContainerRef = useRef(null);
  const iframeRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const boundKeyRef = useRef(null);
  const captionOptionsRef = useRef([]);
  const desiredCaptionRef = useRef('off');
  const captionRetryTimerRef = useRef(null);
  const captionProbeTimerRef = useRef(null);
  const playStartTimerRef = useRef(null);
  const hideControlsTimerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const fsTimerRef = useRef(null);
  const manualFsExitRef = useRef(false);
  const isPlayingStateRef = useRef(false);
  const modeRef = useRef('mini');
  const volumeRef = useRef(100);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const sendYTCommand = useCallback((func, args = []) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        'https://www.youtube-nocookie.com'
      );
    } catch {
      // ignora
    }
  }, []);

  const syncPlayerMetadata = useCallback((player, markLoadedIfEmpty = false) => {
    if (!player) return;

    try {
      const levels = player.getAvailableQualityLevels?.();
      if (Array.isArray(levels) && levels.length > 0) {
        setAvailableQualities(levels);
      }
    } catch {
      // ignora
    }

    const { options, activeCode } = extractCaptionOptions(player);
    if (options.length > 0) {
      captionOptionsRef.current = options;
      setCaptionOptions(options);
      setCaptionsLoaded(true);
    } else if (markLoadedIfEmpty) {
      setCaptionsLoaded(true);
    }

    // Garante que a legenda real do YouTube esteja 100% alinhada com a escolha do usuário
    const targetCode = modeRef.current === 'mini' ? 'off' : desiredCaptionRef.current;
    if (targetCode === 'off') {
      if (activeCode !== 'off') {
        applyCaptionSelection(player, 'off', options);
      }
      setCaptionLang('off');
    } else if (options.length > 0) {
      if (activeCode !== targetCode) {
        applyCaptionSelection(player, targetCode, options);
      }
      setCaptionLang(targetCode);
    }
  }, []);

  // Resolve chave do trailer
  useEffect(() => {
    let cancelled = false;

    const loadVideos = async () => {
      setIsVideoReady(false);
      setCurrentTime(0);
      setDuration(0);
      setCaptionLang('off');
      setCaptionOptions([]);
      setCaptionsLoaded(false);
      setAvailableQualities(null);
      ytPlayerRef.current = null;
      boundKeyRef.current = null;
      captionOptionsRef.current = [];
      desiredCaptionRef.current = 'off';
      isPlayingStateRef.current = false;
      if (playStartTimerRef.current) {
        clearTimeout(playStartTimerRef.current);
        playStartTimerRef.current = null;
      }

      if (preloadedVideos && preloadedVideos.length > 0) {
        const yt = preloadedVideos.filter(
          (v) => v.site === 'YouTube' && isValidYouTubeKey(v.key)
        );
        const key = isValidYouTubeKey(initialTrailerKey)
          ? initialTrailerKey
          : yt[0]?.key || null;
        setResolvedKey(key);
        setLoadingVideos(false);
        return;
      }

      if (isValidYouTubeKey(initialTrailerKey)) {
        setResolvedKey(initialTrailerKey);
        setLoadingVideos(false);
        return;
      }

      setResolvedKey(null);
      if (!mediaId) return;
      setLoadingVideos(true);
      const list = (await getMediaVideos(mediaId, mediaType)).filter((v) =>
        isValidYouTubeKey(v.key)
      );
      if (!cancelled) {
        setResolvedKey(list[0]?.key || null);
        setLoadingVideos(false);
      }
    };

    loadVideos();
    return () => {
      cancelled = true;
      if (playStartTimerRef.current) clearTimeout(playStartTimerRef.current);
    };
  }, [mediaId, mediaType, initialTrailerKey, preloadedVideos]);

  // Escuta eventos em tempo real do player YouTube
  useEffect(() => {
    if (paused || !resolvedKey) return;

    const clearRevealTimer = () => {
      if (playStartTimerRef.current) {
        clearTimeout(playStartTimerRef.current);
        playStartTimerRef.current = null;
      }
    };

    const handleMessage = (event) => {
      if (!YT_ORIGINS.has(event.origin)) return;
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;

      let payload = event.data;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }

      if (!payload || typeof payload !== 'object') return;

      const info = payload.info;
      const state =
        payload.event === 'onStateChange'
          ? info
          : payload.event === 'infoDelivery' && info?.playerState !== undefined
            ? info.playerState
            : null;

      if (payload.event === 'infoDelivery' && info && typeof info === 'object') {
        if (typeof info.currentTime === 'number') setCurrentTime(info.currentTime);
        if (typeof info.duration === 'number' && info.duration > 0) {
          setDuration(info.duration);
        }
      }

      if (state === 1) {
        isPlayingStateRef.current = true;
        setIsPlaying(true);

        if (modeRef.current === 'expanded') {
          setIsVideoReady(true);
        } else if (!playStartTimerRef.current) {
          playStartTimerRef.current = setTimeout(() => {
            if (isPlayingStateRef.current) {
              setIsVideoReady(true);
            }
          }, 2100);
        }
      } else if (state === 0) {
        isPlayingStateRef.current = false;
        setIsPlaying(false);
        clearRevealTimer();

        if (modeRef.current === 'mini') {
          setIsVideoReady(false);
          sendYTCommand('seekTo', [0, true]);
          sendYTCommand('playVideo');
        }
      } else if (state === 2) {
        isPlayingStateRef.current = false;
        setIsPlaying(false);
        clearRevealTimer();
        if (modeRef.current === 'mini') setIsVideoReady(false);
      } else if (state === 3 || state === -1) {
        isPlayingStateRef.current = false;
        clearRevealTimer();
        if (modeRef.current === 'mini') setIsVideoReady(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearRevealTimer();
    };
  }, [paused, resolvedKey, sendYTCommand]);

  const bumpControlsActivity = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = setTimeout(() => {
      if (modeRef.current === 'expanded' && isPlayingStateRef.current) {
        setControlsVisible(false);
      }
    }, 2600);
  }, []);

  // Expande o MESMO iframe suavemente até 100% e entra em tela cheia nativa logo após a animação
  const openFullscreen = useCallback(() => {
    if (modeRef.current !== 'mini') return;
    const rect = slotRef.current?.getBoundingClientRect() || null;
    setAnchorRect(rect);
    setMode('entering');
    onExpandChange?.(true);
    notifyPlayerOverlay(true);
    document.body.style.overflow = 'hidden';

    if (resolvedKey) {
      setIsVideoReady(true);
      setIsMuted(false);
      sendYTCommand('unMute');
      sendYTCommand('setVolume', [volumeRef.current]);
      sendYTCommand('playVideo');
      if (ytPlayerRef.current) {
        ytPlayerRef.current.loadModule?.('captions');
        setTimeout(() => syncPlayerMetadata(ytPlayerRef.current, true), 220);
      }
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMode('expanded');
        bumpControlsActivity();
      });
    });

    // Entra automaticamente em tela cheia nativa assim que a expansão suave termina
    if (fsTimerRef.current) clearTimeout(fsTimerRef.current);
    fsTimerRef.current = setTimeout(() => {
      if (modeRef.current === 'expanded' && !document.fullscreenElement) {
        playerContainerRef.current?.requestFullscreen?.().catch(() => {});
      }
    }, 450);
  }, [resolvedKey, sendYTCommand, syncPlayerMetadata, onExpandChange, bumpControlsActivity]);

  // Recolhe o MESMO iframe suavemente de volta para o cantinho sem recarregar
  const closeFullscreen = useCallback(() => {
    if (modeRef.current === 'mini' || modeRef.current === 'closing') return;

    if (fsTimerRef.current) {
      clearTimeout(fsTimerRef.current);
      fsTimerRef.current = null;
    }

    if (document.fullscreenElement) {
      manualFsExitRef.current = true;
      document.exitFullscreen?.().catch(() => {});
    }

    const rect = slotRef.current?.getBoundingClientRect() || anchorRect;
    setAnchorRect(rect);
    setMode('closing');

    if (resolvedKey) {
      setIsMuted(true);
      sendYTCommand('mute');
      sendYTCommand('playVideo');
      if (ytPlayerRef.current) {
        applyCaptionSelection(ytPlayerRef.current, 'off', captionOptionsRef.current);
      }
    }

    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setMode('mini');
      document.body.style.overflow = '';
      onExpandChange?.(false);
      notifyPlayerOverlay(false);
    }, 420);
  }, [anchorRect, resolvedKey, sendYTCommand, onExpandChange]);

  useImperativeHandle(
    ref,
    () => ({
      openFullscreen,
      closeFullscreen,
    }),
    [openFullscreen, closeFullscreen]
  );

  // Sincroniza saída da tela cheia nativa: se o usuário apertou ESC no fullscreen, recolhe suavemente
  useEffect(() => {
    const onFsChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsNativeFullscreen(active);
      if (!active && modeRef.current === 'expanded') {
        if (manualFsExitRef.current) {
          manualFsExitRef.current = false;
        } else {
          closeFullscreen();
        }
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [closeFullscreen]);

  // Atalhos de teclado quando expandido
  useEffect(() => {
    if (mode !== 'expanded') return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeFullscreen();
      } else if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isPlayingStateRef.current) sendYTCommand('pauseVideo');
        else sendYTCommand('playVideo');
        bumpControlsActivity();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        sendYTCommand('seekTo', [currentTime + 10, true]);
        bumpControlsActivity();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        sendYTCommand('seekTo', [Math.max(0, currentTime - 10), true]);
        bumpControlsActivity();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (isMuted) {
          setIsMuted(false);
          sendYTCommand('unMute');
        } else {
          setIsMuted(true);
          sendYTCommand('mute');
        }
        bumpControlsActivity();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mode, closeFullscreen, sendYTCommand, bumpControlsActivity, currentTime, isMuted]);

  useEffect(() => {
    if (mode !== 'expanded') return;
    const poll = setInterval(() => {
      const p = ytPlayerRef.current;
      if (!p) return;
      try {
        const t = p.getCurrentTime?.();
        const d = p.getDuration?.();
        if (typeof t === 'number' && Number.isFinite(t)) setCurrentTime(t);
        if (typeof d === 'number' && d > 0) setDuration(d);
      } catch {
        // ignora
      }
    }, 250);
    return () => clearInterval(poll);
  }, [mode]);

  useEffect(() => {
    return () => {
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (fsTimerRef.current) clearTimeout(fsTimerRef.current);
      if (captionRetryTimerRef.current) clearTimeout(captionRetryTimerRef.current);
      if (captionProbeTimerRef.current) clearTimeout(captionProbeTimerRef.current);
      ytPlayerRef.current = null;
      if (modeRef.current !== 'mini') {
        document.body.style.overflow = '';
        notifyPlayerOverlay(false);
      }
    };
  }, []);

  const handleIframeLoad = () => {
    const iframeEl = iframeRef.current;
    const win = iframeEl?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(
        JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
        'https://www.youtube-nocookie.com'
      );
    } catch {
      // ignora
    }

    const currentKey = resolvedKey;
    loadYouTubeIframeApi().then((YT) => {
      if (!YT || !iframeRef.current || boundKeyRef.current === currentKey) return;
      boundKeyRef.current = currentKey;
      try {
        const player = new YT.Player(iframeRef.current, {
          events: {
            onReady: (e) => {
              ytPlayerRef.current = e.target;
              try {
                e.target.loadModule?.('captions');
              } catch {
                // ignora
              }
              if (captionProbeTimerRef.current) clearTimeout(captionProbeTimerRef.current);
              captionProbeTimerRef.current = setTimeout(() => {
                syncPlayerMetadata(e.target, true);
              }, 900);
            },
            onApiChange: (e) => {
              ytPlayerRef.current = e.target;
              syncPlayerMetadata(e.target, false);
            },
            onStateChange: (e) => {
              ytPlayerRef.current = e.target;
              if (e.data === 1) {
                syncPlayerMetadata(e.target, false);
              }
            },
          },
        });
        ytPlayerRef.current = player;
      } catch {
        // fallback para postMessage já ativo
      }
    });
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      sendYTCommand('pauseVideo');
      setIsPlaying(false);
      setControlsVisible(true);
    } else {
      sendYTCommand('playVideo');
      setIsPlaying(true);
      bumpControlsActivity();
    }
  };

  const handleSeek = (secs) => {
    setCurrentTime(secs);
    sendYTCommand('seekTo', [secs, true]);
    bumpControlsActivity();
  };

  const handleSkip = (delta) => {
    const target = Math.max(0, Math.min(duration || currentTime + delta, currentTime + delta));
    handleSeek(target);
  };

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      sendYTCommand('unMute');
      sendYTCommand('setVolume', [volume || 100]);
    } else {
      setIsMuted(true);
      sendYTCommand('mute');
    }
    bumpControlsActivity();
  };

  const handleVolumeChange = (val) => {
    setVolume(val);
    if (val === 0) {
      setIsMuted(true);
      sendYTCommand('mute');
    } else {
      setIsMuted(false);
      sendYTCommand('unMute');
      sendYTCommand('setVolume', [val]);
    }
    bumpControlsActivity();
  };

  const handleCaptionLangChange = (langCode) => {
    desiredCaptionRef.current = langCode;
    setCaptionLang(langCode);

    const player = ytPlayerRef.current;
    if (player) {
      applyCaptionSelection(player, langCode, captionOptionsRef.current);
      if (captionRetryTimerRef.current) clearTimeout(captionRetryTimerRef.current);
      if (langCode !== 'off') {
        captionRetryTimerRef.current = setTimeout(() => {
          if (desiredCaptionRef.current === langCode && ytPlayerRef.current) {
            const { options } = extractCaptionOptions(ytPlayerRef.current);
            if (options.length > 0) {
              captionOptionsRef.current = options;
              setCaptionOptions(options);
              setCaptionsLoaded(true);
            }
            applyCaptionSelection(ytPlayerRef.current, langCode, captionOptionsRef.current);
          }
        }, 320);
      }
    } else if (langCode === 'off') {
      sendYTCommand('setOption', ['captions', 'track', {}]);
      sendYTCommand('setOption', ['cc', 'track', {}]);
      sendYTCommand('unloadModule', ['captions']);
      sendYTCommand('unloadModule', ['cc']);
    } else {
      sendYTCommand('loadModule', ['captions']);
      setTimeout(() => {
        sendYTCommand('setOption', ['captions', 'track', { languageCode: langCode }]);
      }, 250);
    }

    bumpControlsActivity();
  };

  const handleQualityChange = (qVal) => {
    setQuality(qVal);
    if (ytPlayerRef.current) {
      try {
        ytPlayerRef.current.setPlaybackQuality?.(qVal);
        ytPlayerRef.current.setPlaybackQualityRange?.(qVal, qVal);
      } catch {
        // ignora
      }
    }
    sendYTCommand('setPlaybackQuality', [qVal]);
    sendYTCommand('setPlaybackQualityRange', [qVal, qVal]);
    bumpControlsActivity();
  };

  const handleRateChange = (rate) => {
    setPlaybackRate(rate);
    sendYTCommand('setPlaybackRate', [rate]);
    bumpControlsActivity();
  };

  const handleToggleNativeFullscreen = () => {
    const el = playerContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      manualFsExitRef.current = true;
      document.exitFullscreen?.().catch(() => {});
    }
    bumpControlsActivity();
  };

  const isExpanded = mode === 'expanded';
  const isOverlay = mode !== 'mini';
  const showIframe = !paused && resolvedKey && isValidYouTubeKey(resolvedKey);
  const thumbUrl = getBackdropUrl(backdropPath, 'w780');
  const originParam =
    typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';

  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${title} trailer oficial`
  )}`;

  const fixedStyle = !isOverlay
    ? undefined
    : isExpanded
      ? {
          position: 'fixed',
          top: '0px',
          left: '0px',
          width: '100vw',
          height: '100vh',
          borderRadius: '0px',
          zIndex: 9999,
        }
      : anchorRect
        ? {
            position: 'fixed',
            top: `${anchorRect.top}px`,
            left: `${anchorRect.left}px`,
            width: `${anchorRect.width}px`,
            height: `${anchorRect.height}px`,
            borderRadius: '16px',
            zIndex: 9999,
          }
        : {
            position: 'fixed',
            top: '5vh',
            left: '5vw',
            width: '90vw',
            height: '90vh',
            borderRadius: '20px',
            zIndex: 9999,
          };

  return (
    <div
      ref={slotRef}
      onClick={(e) => e.stopPropagation()}
      className={`relative aspect-[16/10] flex-shrink-0 ${className}`}
    >
      {isOverlay && (
        <div
          className={`fixed inset-0 z-[9998] bg-[#09090B] transition-opacity duration-300 ${
            isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />
      )}

      {/* ÚNICO CONTAINER PERSISTENTE DO PLAYER */}
      <div
        ref={playerContainerRef}
        style={
          isOverlay
            ? {
                ...fixedStyle,
                transition:
                  'top 420ms cubic-bezier(0.22, 1, 0.36, 1), left 420ms cubic-bezier(0.22, 1, 0.36, 1), width 420ms cubic-bezier(0.22, 1, 0.36, 1), height 420ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 420ms cubic-bezier(0.22, 1, 0.36, 1)',
              }
            : undefined
        }
        onClick={!isOverlay ? openFullscreen : undefined}
        role={!isOverlay ? 'button' : 'dialog'}
        tabIndex={!isOverlay ? 0 : undefined}
        onKeyDown={
          !isOverlay
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openFullscreen();
                }
              }
            : undefined
        }
        aria-label={`Assistir trailer de ${title}`}
        className={`overflow-hidden bg-[#09090B] ${
          !isOverlay
            ? 'group absolute inset-0 rounded-2xl border border-white/20 hover:border-white/40 shadow-[0_22px_55px_rgba(0,0,0,0.8)] cursor-pointer transition-transform duration-300 hover:scale-[1.03]'
            : 'shadow-2xl'
        }`}
      >
        {thumbUrl && (
          <img
            src={thumbUrl}
            alt={`Trailer de ${title}`}
            className={`absolute inset-0 w-full h-full object-cover transition-transform duration-500 ${
              !isOverlay ? 'opacity-90 group-hover:scale-105' : 'opacity-40'
            }`}
          />
        )}

        {showIframe && (
          <div
            className={`absolute inset-0 overflow-hidden pointer-events-none transition-opacity duration-500 ${
              isVideoReady || isExpanded ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <iframe
              id={iframeDomId}
              ref={iframeRef}
              key={resolvedKey}
              src={`https://www.youtube-nocookie.com/embed/${resolvedKey}?autoplay=1&mute=1&controls=0&rel=0&modestbranding=1&iv_load_policy=3&fs=0&disablekb=1&cc_load_policy=0&cc_lang_pref=pt&hl=pt-BR&playsinline=1&enablejsapi=1&origin=${originParam}`}
              title={`Trailer - ${title}`}
              frameBorder="0"
              tabIndex={-1}
              referrerPolicy="strict-origin-when-cross-origin"
              allow="autoplay; encrypted-media"
              onLoad={handleIframeLoad}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-500 ${
                isExpanded ? 'w-full h-full' : 'w-[138%] h-[138%]'
              }`}
            />
          </div>
        )}

        {!isOverlay && (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-black/25 via-transparent to-black/35 pointer-events-none" />
            <span className="absolute top-3.5 left-3.5 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white text-[#09090B] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform z-10">
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </span>
          </>
        )}

        {isExpanded &&
          (showIframe ? (
            <StudioPlayerControls
              title={title}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              isMuted={isMuted}
              volume={volume}
              captionLang={captionLang}
              captionOptions={captionOptions}
              captionsLoaded={captionsLoaded}
              quality={quality}
              availableQualities={availableQualities}
              playbackRate={playbackRate}
              isFullscreen={isNativeFullscreen}
              visible={controlsVisible || !isPlaying}
              onClose={closeFullscreen}
              onTogglePlay={handleTogglePlay}
              onSeek={handleSeek}
              onSkip={handleSkip}
              onToggleMute={handleToggleMute}
              onVolumeChange={handleVolumeChange}
              onCaptionLangChange={handleCaptionLangChange}
              onQualityChange={handleQualityChange}
              onRateChange={handleRateChange}
              onToggleFullscreen={handleToggleNativeFullscreen}
              onActivity={bumpControlsActivity}
            />
          ) : loadingVideos ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#09090B] text-white/60">
              <Loader2 className="w-9 h-9 text-white animate-spin" />
              <span className="text-sm font-medium">Buscando trailer...</span>
            </div>
          ) : (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 text-center bg-[#09090B]/95 backdrop-blur-md">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.06] border border-white/[0.1] text-white/45 flex items-center justify-center mb-5">
                <Film className="w-8 h-8" />
              </div>
              <h4 className="text-2xl font-medium text-white mb-2">
                Trailer indisponível no catálogo
              </h4>
              <p className="text-sm text-white/50 max-w-md mb-7">
                Não encontramos um trailer oficial incorporado para{' '}
                <strong className="text-white/85">{title}</strong>, mas você pode assistir diretamente no YouTube.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href={youtubeSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-white hover:bg-white/90 text-[#09090B] font-semibold px-6 py-3 rounded-xl text-sm transition-colors"
                >
                  Buscar no YouTube
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={closeFullscreen}
                  className="inline-flex items-center gap-2 bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.14] text-white font-medium px-6 py-3 rounded-xl text-sm transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
});

export default TrailerPreviewCard;
