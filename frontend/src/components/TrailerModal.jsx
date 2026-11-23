import React, { useEffect, useState, useRef, useCallback, useId } from 'react';
import { ArrowLeft, ExternalLink, Film, Loader2 } from 'lucide-react';
import { getMediaVideos } from '../services/api';
import { isValidYouTubeKey } from '../utils/security';
import {
  loadYouTubeIframeApi,
  isYouTubePlayerAttached,
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

export default function TrailerModal({
  isOpen,
  onClose,
  mediaId,
  mediaType = 'tv',
  title = '',
  preloadedVideos = null,
}) {
  const [activeKey, setActiveKey] = useState(null);
  const [loading, setLoading] = useState(false);

  const [phase, setPhase] = useState('idle');
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
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
  const iframeDomId = `yt-modal-${rawUid.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const rawPlayerRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const ytReadyRef = useRef(false);
  const isMountedRef = useRef(true);
  const bindTokenRef = useRef(0);
  const boundKeyRef = useRef(null);
  const captionOptionsRef = useRef([]);
  const desiredCaptionRef = useRef('off');
  const captionRetryTimerRef = useRef(null);
  const captionProbeTimerRef = useRef(null);
  const closingRef = useRef(false);
  const closeTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const fsTimerRef = useRef(null);
  const manualFsExitRef = useRef(false);
  const isPlayingRef = useRef(true);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const getReadyPlayer = useCallback(() => {
    if (!isMountedRef.current || !ytReadyRef.current) return null;
    if (!isYouTubePlayerAttached(ytPlayerRef.current, iframeRef.current)) return null;
    return ytPlayerRef.current;
  }, []);

  const destroyCurrentPlayer = useCallback(() => {
    bindTokenRef.current += 1;
    ytReadyRef.current = false;
    ytPlayerRef.current = null;
    boundKeyRef.current = null;
    const inst = rawPlayerRef.current;
    rawPlayerRef.current = null;
    if (inst && typeof inst.destroy === 'function') {
      try {
        inst.destroy();
      } catch {
        // ignora
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      destroyCurrentPlayer();
    };
  }, [destroyCurrentPlayer]);

  const sendYTCommand = useCallback((func, args = []) => {
    const iframeEl = iframeRef.current;
    if (!iframeEl || !iframeEl.isConnected) return;
    const win = iframeEl.contentWindow;
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
    if (!isMountedRef.current || !isYouTubePlayerAttached(player, iframeRef.current)) return;

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

    const targetCode = desiredCaptionRef.current;
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

  const bumpActivity = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (isPlayingRef.current) setControlsVisible(false);
    }, 2600);
  }, []);

  const handleSmoothClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (fsTimerRef.current) {
      clearTimeout(fsTimerRef.current);
      fsTimerRef.current = null;
    }
    if (document.fullscreenElement) {
      manualFsExitRef.current = true;
      document.exitFullscreen?.().catch(() => {});
    }
    setPhase('closing');
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      closingRef.current = false;
      setPhase('idle');
      notifyPlayerOverlay(false);
      onCloseRef.current?.();
    }, 300);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    closingRef.current = false;
    notifyPlayerOverlay(true);
    let raf1;
    let raf2;
    raf1 = requestAnimationFrame(() => {
      setPhase('entering');
      raf2 = requestAnimationFrame(() => {
        setPhase('expanded');
        bumpActivity();
      });
    });

    if (fsTimerRef.current) clearTimeout(fsTimerRef.current);
    fsTimerRef.current = setTimeout(() => {
      if (!document.fullscreenElement) {
        containerRef.current?.requestFullscreen?.().catch(() => {});
      }
    }, 340);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleSmoothClose();
      else if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isPlayingRef.current) sendYTCommand('pauseVideo');
        else sendYTCommand('playVideo');
        bumpActivity();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      notifyPlayerOverlay(false);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (fsTimerRef.current) clearTimeout(fsTimerRef.current);
      if (captionRetryTimerRef.current) clearTimeout(captionRetryTimerRef.current);
      if (captionProbeTimerRef.current) clearTimeout(captionProbeTimerRef.current);
      destroyCurrentPlayer();
    };
  }, [isOpen, handleSmoothClose, sendYTCommand, bumpActivity, destroyCurrentPlayer]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const load = async () => {
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
      if (preloadedVideos && preloadedVideos.length > 0) {
        const yt = preloadedVideos.filter(
          (v) => v.site === 'YouTube' && isValidYouTubeKey(v.key)
        );
        setActiveKey(yt[0]?.key || null);
        setLoading(false);
        return;
      }

      if (!mediaId) {
        setActiveKey(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const list = (await getMediaVideos(mediaId, mediaType)).filter((v) =>
        isValidYouTubeKey(v.key)
      );
      if (!cancelled) {
        setActiveKey(list[0]?.key || null);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, mediaId, mediaType, preloadedVideos]);

  useEffect(() => {
    if (!isOpen || !activeKey) return;
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
        if (typeof info.duration === 'number' && info.duration > 0) setDuration(info.duration);
      }
      if (state === 1) {
        isPlayingRef.current = true;
        setIsPlaying(true);
      } else if (state === 2 || state === 0) {
        isPlayingRef.current = false;
        setIsPlaying(false);
        setControlsVisible(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, activeKey]);

  useEffect(() => {
    const onFs = () => {
      const active = Boolean(document.fullscreenElement);
      setIsNativeFullscreen(active);
      if (!active && isOpen) {
        if (manualFsExitRef.current) {
          manualFsExitRef.current = false;
        } else {
          handleSmoothClose();
        }
      }
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [isOpen, handleSmoothClose]);

  if (!isOpen && phase === 'idle') return null;

  const isExpanded = phase === 'expanded';
  const originParam =
    typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${title} trailer oficial`
  )}`;

  const handleIframeLoad = () => {
    if (!isMountedRef.current) return;
    const iframeEl = iframeRef.current;
    if (!iframeEl || !iframeEl.isConnected) return;
    iframeEl.contentWindow?.postMessage(
      JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
      'https://www.youtube-nocookie.com'
    );

    const currentKey = activeKey;
    const token = ++bindTokenRef.current;
    loadYouTubeIframeApi().then((YT) => {
      if (
        !isMountedRef.current ||
        token !== bindTokenRef.current ||
        !YT ||
        !iframeRef.current ||
        !iframeRef.current.isConnected ||
        boundKeyRef.current === currentKey
      ) {
        return;
      }
      boundKeyRef.current = currentKey;
      try {
        const player = new YT.Player(iframeRef.current, {
          events: {
            onReady: (e) => {
              if (
                !isMountedRef.current ||
                token !== bindTokenRef.current ||
                !isYouTubePlayerAttached(e.target, iframeRef.current)
              ) {
                return;
              }
              ytReadyRef.current = true;
              ytPlayerRef.current = e.target;
              if (captionProbeTimerRef.current) clearTimeout(captionProbeTimerRef.current);
              captionProbeTimerRef.current = setTimeout(() => {
                const readyP = getReadyPlayer();
                if (!readyP) return;
                try {
                  readyP.loadModule?.('captions');
                } catch {
                  // ignora
                }
                syncPlayerMetadata(readyP, true);
              }, 900);
            },
            onApiChange: (e) => {
              if (
                !isMountedRef.current ||
                token !== bindTokenRef.current ||
                !ytReadyRef.current ||
                !isYouTubePlayerAttached(e.target, iframeRef.current)
              ) {
                return;
              }
              ytPlayerRef.current = e.target;
              syncPlayerMetadata(e.target, false);
            },
            onStateChange: (e) => {
              if (
                !isMountedRef.current ||
                token !== bindTokenRef.current ||
                !ytReadyRef.current ||
                !isYouTubePlayerAttached(e.target, iframeRef.current)
              ) {
                return;
              }
              ytPlayerRef.current = e.target;
              if (e.data === 1) {
                syncPlayerMetadata(e.target, false);
              }
            },
          },
        });
        rawPlayerRef.current = player;
      } catch {
        // fallback para postMessage
      }
    });
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Trailer de ${title}`}
      className={`fixed inset-0 z-[9999] bg-[#09090B] overflow-hidden transition-all duration-300 ${
        isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.96]'
      }`}
    >
      {loading ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white/55">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
          <span className="text-sm font-medium">Carregando trailer...</span>
        </div>
      ) : activeKey && isValidYouTubeKey(activeKey) ? (
        <>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <iframe
              id={iframeDomId}
              ref={iframeRef}
              key={activeKey}
              src={`https://www.youtube-nocookie.com/embed/${activeKey}?autoplay=1&controls=0&rel=0&modestbranding=1&iv_load_policy=3&fs=0&disablekb=1&cc_load_policy=0&cc_lang_pref=pt&hl=pt-BR&playsinline=1&enablejsapi=1&origin=${originParam}`}
              title={`Trailer - ${title}`}
              frameBorder="0"
              tabIndex={-1}
              referrerPolicy="strict-origin-when-cross-origin"
              allow="autoplay; encrypted-media"
              onLoad={handleIframeLoad}
              className="w-full h-full pointer-events-none"
            />
          </div>

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
            onClose={handleSmoothClose}
            onTogglePlay={() => {
              if (isPlaying) {
                sendYTCommand('pauseVideo');
                setIsPlaying(false);
                setControlsVisible(true);
              } else {
                sendYTCommand('playVideo');
                setIsPlaying(true);
                bumpActivity();
              }
            }}
            onSeek={(secs) => {
              setCurrentTime(secs);
              sendYTCommand('seekTo', [secs, true]);
              bumpActivity();
            }}
            onSkip={(delta) => {
              const t = Math.max(0, Math.min(duration || currentTime + delta, currentTime + delta));
              setCurrentTime(t);
              sendYTCommand('seekTo', [t, true]);
              bumpActivity();
            }}
            onToggleMute={() => {
              if (isMuted) {
                setIsMuted(false);
                sendYTCommand('unMute');
                sendYTCommand('setVolume', [volume || 100]);
              } else {
                setIsMuted(true);
                sendYTCommand('mute');
              }
              bumpActivity();
            }}
            onVolumeChange={(val) => {
              setVolume(val);
              if (val === 0) {
                setIsMuted(true);
                sendYTCommand('mute');
              } else {
                setIsMuted(false);
                sendYTCommand('unMute');
                sendYTCommand('setVolume', [val]);
              }
              bumpActivity();
            }}
            onCaptionLangChange={(langCode) => {
              desiredCaptionRef.current = langCode;
              setCaptionLang(langCode);
              const player = getReadyPlayer();
              if (player) {
                applyCaptionSelection(player, langCode, captionOptionsRef.current);
                if (captionRetryTimerRef.current) clearTimeout(captionRetryTimerRef.current);
                if (langCode !== 'off') {
                  captionRetryTimerRef.current = setTimeout(() => {
                    const readyP = getReadyPlayer();
                    if (desiredCaptionRef.current === langCode && readyP) {
                      const { options } = extractCaptionOptions(readyP);
                      if (options.length > 0) {
                        captionOptionsRef.current = options;
                        setCaptionOptions(options);
                        setCaptionsLoaded(true);
                      }
                      applyCaptionSelection(
                        readyP,
                        langCode,
                        captionOptionsRef.current
                      );
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
              bumpActivity();
            }}
            onQualityChange={(qVal) => {
              setQuality(qVal);
              const player = getReadyPlayer();
              if (player) {
                try {
                  player.setPlaybackQuality?.(qVal);
                  player.setPlaybackQualityRange?.(qVal, qVal);
                } catch {
                  // ignora
                }
              }
              sendYTCommand('setPlaybackQuality', [qVal]);
              sendYTCommand('setPlaybackQualityRange', [qVal, qVal]);
              bumpActivity();
            }}
            onRateChange={(rate) => {
              setPlaybackRate(rate);
              sendYTCommand('setPlaybackRate', [rate]);
              bumpActivity();
            }}
            onToggleFullscreen={() => {
              if (!document.fullscreenElement) {
                containerRef.current?.requestFullscreen?.().catch(() => {});
              } else {
                manualFsExitRef.current = true;
                document.exitFullscreen?.().catch(() => {});
              }
              bumpActivity();
            }}
            onActivity={bumpActivity}
          />
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
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
              onClick={handleSmoothClose}
              className="inline-flex items-center gap-2 bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.14] text-white font-medium px-6 py-3 rounded-xl text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
