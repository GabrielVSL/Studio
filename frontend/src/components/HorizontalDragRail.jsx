import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Trilho horizontal com arrasto pelo mouse (click & drag), setas ← → e touch.
 * Bloqueia cliques acidentais em <Link> quando o usuário arrastou mais de 5px.
 */
export default function HorizontalDragRail({
  title,
  subtitle = null,
  headerExtra = null,
  edgeColor = '#09090B',
  showEdges = true,
  className = '',
  railClassName = 'gap-4 pt-2 pb-4',
  children,
}) {
  const railRef = useRef(null);
  const dragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0, moved: false });
  const [isDragging, setIsDragging] = useState(false);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateScrollEdges = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return undefined;
    updateScrollEdges();
    const ro = new ResizeObserver(updateScrollEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, updateScrollEdges]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragRef.current.isDown || !railRef.current) return;
      const dx = e.pageX - dragRef.current.startX;
      if (Math.abs(dx) > 5) {
        dragRef.current.moved = true;
        setIsDragging(true);
      }
      if (dragRef.current.moved) {
        e.preventDefault();
        railRef.current.scrollLeft = dragRef.current.scrollLeft - dx * 1.15;
      }
    };

    const handleMouseUp = () => {
      if (!dragRef.current.isDown) return;
      dragRef.current.isDown = false;
      setIsDragging(false);
      setTimeout(() => {
        dragRef.current.moved = false;
      }, 40);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleMouseDown = (e) => {
    if (e.button !== 0 || !railRef.current) return;
    dragRef.current = {
      isDown: true,
      startX: e.pageX,
      scrollLeft: railRef.current.scrollLeft,
      moved: false,
    };
  };

  // Captura cliques em qualquer filho (<Link>, <button>) após arraste para evitar navegação acidental
  const handleClickCapture = (e) => {
    if (dragRef.current.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const scrollByStep = (dir) => {
    const el = railRef.current;
    if (!el) return;
    const distance = Math.max(300, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: dir * distance, behavior: 'smooth' });
  };

  const hasOverflow = canLeft || canRight;

  return (
    <div className={className}>
      {(title || headerExtra || hasOverflow) && (
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            {title && (
              <div>
                <h2 className="text-lg sm:text-xl font-medium text-white">{title}</h2>
                {subtitle && (
                  <p className="text-xs sm:text-sm text-white/45 mt-0.5">{subtitle}</p>
                )}
              </div>
            )}
            {headerExtra}
          </div>

          {hasOverflow && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => scrollByStep(-1)}
                disabled={!canLeft}
                aria-label={`Anterior em ${title || 'lista'}`}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.15] border border-white/[0.1] text-white flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollByStep(1)}
                disabled={!canRight}
                aria-label={`Próximo em ${title || 'lista'}`}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.15] border border-white/[0.1] text-white flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        {showEdges && canLeft && (
          <div
            className="hidden sm:block absolute left-0 top-0 bottom-0 w-10 z-20 pointer-events-none"
            style={{ background: `linear-gradient(to right, ${edgeColor}, transparent)` }}
          />
        )}
        {showEdges && canRight && (
          <div
            className="hidden sm:block absolute right-0 top-0 bottom-0 w-14 z-20 pointer-events-none"
            style={{ background: `linear-gradient(to left, ${edgeColor}, transparent)` }}
          />
        )}

        <div
          ref={railRef}
          onMouseDown={handleMouseDown}
          onClickCapture={handleClickCapture}
          onScroll={updateScrollEdges}
          className={`flex overflow-x-auto overflow-y-hidden hide-scrollbar select-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          } ${railClassName}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
