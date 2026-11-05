import React, { useState, useEffect, useRef } from 'react';
import { useToaster, ToastBar, toast, resolveValue } from 'react-hot-toast';

const ToastWrapper = ({ id, onHeightUpdate, style, children }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const updateHeight = () => {
      const height = el.getBoundingClientRect().height;
      onHeightUpdate(id, height);
    };

    updateHeight();

    const observer = new MutationObserver(updateHeight);
    observer.observe(el, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [id, onHeightUpdate]);

  return (
    <div ref={ref} style={{ ...style, pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto' }}>
        {children}
      </div>
    </div>
  );
};

const getPositionStyle = (position, offset) => {
  const top = position.includes('top');
  const verticalStyle = top ? { top: 0 } : { bottom: 0 };
  const horizontalStyle = position.includes('center')
    ? { justifyContent: 'center' }
    : position.includes('right')
    ? { justifyContent: 'flex-end' }
    : { justifyContent: 'flex-start' };

  return {
    left: 0,
    right: 0,
    display: 'flex',
    position: 'absolute',
    transition: 'all 230ms cubic-bezier(.21,1.02,.73,1)',
    transform: `translateY(${offset * (top ? 1 : -1)}px)`,
    ...verticalStyle,
    ...horizontalStyle,
  };
};

export const AppToaster = ({
  position = 'top-right',
  toastOptions,
  gutter = 8,
  containerStyle,
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth <= 768 ||
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
      );
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const effectivePosition = isMobile ? 'top-center' : position;
  const { toasts, handlers } = useToaster(toastOptions);

  return (
    <div
      data-chatdocs-toaster=""
      style={{
        position: 'fixed',
        zIndex: 99999,
        top: 16,
        left: 16,
        right: 16,
        bottom: 16,
        pointerEvents: 'none',
        ...containerStyle,
      }}
      onMouseEnter={() => {
        // Only pause on desktop where a real mouse cursor can leave
        if (!isMobile && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
          handlers.startPause();
        }
      }}
      onMouseLeave={() => {
        handlers.endPause();
      }}
      onTouchStart={() => {
        // Ensure touch does not trap the timer indefinitely
      }}
      onTouchEnd={() => {
        // Always unpause when touch interaction completes
        handlers.endPause();
      }}
      onTouchCancel={() => {
        handlers.endPause();
      }}
    >
      {toasts.map((t) => {
        const toastPosition = t.position || effectivePosition;
        const offset = handlers.calculateOffset(t, {
          gutter,
          defaultPosition: effectivePosition,
        });
        const positionStyle = getPositionStyle(toastPosition, offset);

        return (
          <ToastWrapper
            id={t.id}
            key={t.id}
            onHeightUpdate={handlers.updateHeight}
            style={positionStyle}
          >
            {t.type === 'custom' ? (
              <div
                onClick={() => {
                  // Allow tapping custom confirmation toasts if applicable
                }}
              >
                {resolveValue(t.message, t)}
              </div>
            ) : (
              <ToastBar toast={t} position={toastPosition}>
                {({ icon, message }) => (
                  <div
                    onClick={() => {
                      if (t.type !== 'loading') {
                        toast.dismiss(t.id);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      cursor: t.type !== 'loading' ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    {icon}
                    <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center' }}>
                      {message}
                    </div>
                    {t.type !== 'loading' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.dismiss(t.id);
                        }}
                        aria-label="Close notification"
                        style={{
                          marginLeft: '6px',
                          background: 'transparent',
                          border: 'none',
                          color: 'rgba(255, 255, 255, 0.45)',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          fontSize: '13px',
                          lineHeight: 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px',
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.45)')}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </ToastBar>
            )}
          </ToastWrapper>
        );
      })}
    </div>
  );
};

export default AppToaster;

