import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { gsap } from 'gsap';

import './AccordionGallery.css';

const AccordionGallery = ({
  items = [],
  defaultIndex = 2,
  accentColor = '#FE3131',
  overlayColor = '#09090B',
  textColor = '#ffffff',
  height = 440,
  gap = 10,
  radius = 16,
  expandRatio = 0.46,
  orientation = 'horizontal',
  duration = 0.6,
  ease = 'power3.out',
  parallax = 0.5,
  tilt = 8,
  stagger = 0.06,
  trigger = 'hover',
  showLabels = true,
  grayscale = true,
  onActiveChange,
  onSelect,
  className = '',
}) => {
  const rootRef = useRef(null);
  const panelRefs = useRef([]);
  const mediaRefs = useRef([]);
  const copyRefs = useRef([]);
  const ctaRefs = useRef([]);
  const tlRef = useRef(null);
  const firstRunRef = useRef(true);
  const mediaSizeRef = useRef(360);

  const vertical = orientation === 'vertical';
  const count = items.length;
  const [active, setActive] = useState(() =>
    count > 0 ? Math.min(Math.max(defaultIndex, 0), count - 1) : 0
  );

  const safeActive = count > 0 ? Math.min(active, count - 1) : 0;

  useEffect(() => {
    if (count > 0) {
      onActiveChange?.(safeActive, items[safeActive]);
    }
  }, [safeActive, count, items, onActiveChange]);

  const prefersReduced =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  const applyLayout = useCallback(
    (animate) => {
      const panels = panelRefs.current.slice(0, count);
      if (!panels.length) return;

      const r = Math.min(Math.max(expandRatio, 0.2), 0.9);
      const grow = count > 1 ? (r * (count - 1)) / (1 - r) : 1;
      const mediaSize = mediaSizeRef.current;

      tlRef.current?.kill();
      const dur = animate && !prefersReduced ? duration : 0;
      const tl = gsap.timeline();

      panels.forEach((panel, i) => {
        if (!panel) return;
        const isActive = i === safeActive;
        const media = mediaRefs.current[i];
        const copy = copyRefs.current[i];
        const cta = ctaRefs.current[i];

        const rot = isActive ? 0 : i < safeActive ? tilt : -tilt;
        const rotProp = vertical ? { rotateX: -rot } : { rotateY: rot };

        tl.to(panel, { flexGrow: isActive ? grow : 1, ...rotProp, duration: dur, ease }, 0);

        if (media) {
          const drift = Math.max(-1.5, Math.min(1.5, safeActive - i));
          const shift = drift * parallax * mediaSize * 0.06;
          const gray = grayscale ? (isActive ? 0 : 1) : 0;
          tl.to(
            media,
            {
              xPercent: -50,
              yPercent: -50,
              x: vertical ? 0 : isActive ? 0 : shift,
              y: vertical ? (isActive ? 0 : shift) : 0,
              '--ag-gray': gray,
              '--ag-dim': isActive ? 0 : 0.38,
              duration: dur,
              ease,
            },
            0
          );
        }

        if (showLabels && copy && cta) {
          if (isActive) {
            tl.to(
              [copy, cta],
              { opacity: 1, y: 0, duration: dur, ease, stagger: prefersReduced ? 0 : stagger },
              0
            );
          } else {
            tl.to([copy, cta], { opacity: 0, y: 12, duration: dur * 0.55, ease }, 0);
          }
        }
      });

      tlRef.current = tl;
    },
    [
      safeActive,
      count,
      expandRatio,
      duration,
      ease,
      vertical,
      tilt,
      parallax,
      grayscale,
      showLabels,
      stagger,
      prefersReduced,
    ]
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el || count === 0) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const total = vertical ? rect.height : rect.width;
      const usable = Math.max(total - gap * (count - 1), 120);
      const size = Math.max(220, usable * Math.min(Math.max(expandRatio, 0.2), 0.9) * 1.24);
      mediaSizeRef.current = size;
      el.style.setProperty('--ag-media-size', `${size}px`);
      applyLayout(!firstRunRef.current);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyLayout, gap, count, expandRatio, vertical]);

  useEffect(() => {
    if (count === 0) return;
    applyLayout(!firstRunRef.current);
    firstRunRef.current = false;
  }, [applyLayout, count]);

  useEffect(
    () => () => {
      tlRef.current?.kill();
    },
    []
  );

  if (count === 0) return null;

  const handleEnter = (i) => {
    if (trigger === 'hover') setActive(i);
  };

  const handleClick = (i, item, e) => {
    if (i !== safeActive) {
      e.preventDefault();
      setActive(i);
      return;
    }
    if (onSelect) {
      e.preventDefault();
      onSelect(item, i);
    }
  };

  const handleKeyDown = (i, item, e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i + 1) % count);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i - 1 + count) % count);
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (i === safeActive && onSelect) {
        e.preventDefault();
        onSelect(item, i);
      } else if (i !== safeActive) {
        e.preventDefault();
        setActive(i);
      }
    }
  };

  return (
    <div
      ref={rootRef}
      className={`accordion-gallery${vertical ? ' accordion-gallery--vertical' : ''}${
        className ? ` ${className}` : ''
      }`}
      style={{
        '--ag-accent': accentColor,
        '--ag-overlay': overlayColor,
        '--ag-text': textColor,
        '--ag-gap': `${gap}px`,
        '--ag-radius': `${radius}px`,
        height: vertical ? `${Math.round(height * 1.6)}px` : `${height}px`,
      }}
      role="list"
      aria-label="Categorias de filmes"
    >
      {items.map((item, i) => {
        const isActive = i === safeActive;
        const Tag = item.link ? 'a' : 'div';
        const indexLabel = String(i + 1).padStart(2, '0');
        return (
          <Tag
            key={item.id ?? item.label ?? i}
            ref={(el) => {
              panelRefs.current[i] = el;
            }}
            className={`ag-panel${isActive ? ' ag-panel--active' : ''}`}
            style={{ borderRadius: `${radius}px` }}
            href={item.link || undefined}
            onClick={(e) => handleClick(i, item, e)}
            onMouseEnter={() => handleEnter(i)}
            onFocus={() => setActive(i)}
            onKeyDown={(e) => handleKeyDown(i, item, e)}
            role="listitem"
            tabIndex={0}
            aria-current={isActive ? 'true' : undefined}
            aria-label={item.label}
          >
            <span className="ag-panel__frame">
              <span
                className="ag-panel__media"
                ref={(el) => {
                  mediaRefs.current[i] = el;
                }}
              >
                {item.image && (
                  <img
                    src={item.image}
                    alt={item.alt || item.label || ''}
                    draggable="false"
                    loading="lazy"
                  />
                )}
              </span>
              <span className="ag-panel__overlay" aria-hidden="true" />
            </span>

            <span className="ag-panel__index" aria-hidden="true">
              {indexLabel}
            </span>

            {showLabels && (
              <span className="ag-panel__label" aria-hidden="true">
                <span
                  className="ag-panel__copy"
                  ref={(el) => {
                    copyRefs.current[i] = el;
                  }}
                >
                  <span className="ag-panel__pill">
                    <span className="ag-panel__dot" />
                    {item.eyebrow || 'Filmes'}
                  </span>
                  <span className="ag-panel__text">{item.label}</span>
                  {item.subtitle && <span className="ag-panel__subtitle">{item.subtitle}</span>}
                </span>

                <span
                  className="ag-panel__cta"
                  ref={(el) => {
                    ctaRefs.current[i] = el;
                  }}
                >
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </span>
            )}
          </Tag>
        );
      })}
    </div>
  );
};

export default AccordionGallery;
