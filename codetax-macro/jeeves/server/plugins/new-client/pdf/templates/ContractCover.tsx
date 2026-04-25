import * as React from 'react';
import { PageFrame } from './shared/PageFrame';
import { assetDataUrl } from './shared/asset';
import type { TemplateProps } from './shared/TemplateProps';

const LOGO_WIDE_URL = assetDataUrl('logo-wide.png');

export function ContractCover(_props: TemplateProps) {
  return (
    <PageFrame margin={{ top: '0', right: '0', bottom: '0', left: '0' }}>
      <div
        style={{
          position: 'relative',
          width: '210mm',
          height: '297mm',
          boxSizing: 'border-box',
          fontFamily: 'Pretendard, sans-serif',
          color: '#111',
          background: '#fff',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '24mm',
            left: '22mm',
            width: '14mm',
            height: '14mm',
            borderTop: '1.4px solid #111',
            borderLeft: '1.4px solid #111',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: '155mm',
            right: '22mm',
            textAlign: 'right',
            width: '160mm',
          }}
        >
          <div style={{ position: 'relative', display: 'inline-block', paddingBottom: '4mm' }}>
            <div
              style={{
                position: 'absolute',
                left: '0',
                right: '-2mm',
                top: '8mm',
                height: '14mm',
                background: '#FFE066',
                opacity: 0.85,
                zIndex: 0,
              }}
            />
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                fontSize: '54pt',
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: '-0.01em',
                color: '#111',
              }}
            >
              Tax Service
            </div>
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                marginTop: '3mm',
                borderTop: '1.4px solid #111',
              }}
            />
          </div>
          <div
            style={{
              fontSize: '34pt',
              fontWeight: 700,
              lineHeight: 1,
              marginTop: '6mm',
              paddingBottom: '3mm',
              borderBottom: '1.4px solid #111',
              display: 'inline-block',
              minWidth: '60mm',
              color: '#111',
            }}
          >
            Contract
          </div>
        </div>

        <img
          src={LOGO_WIDE_URL}
          alt="logo"
          style={{
            position: 'absolute',
            bottom: '22mm',
            right: '22mm',
            width: '70mm',
            height: 'auto',
          }}
        />
      </div>
    </PageFrame>
  );
}
