import * as React from 'react';
import * as path from 'node:path';
import { PageFrame } from './shared/PageFrame';
import type { TemplateProps } from './shared/TemplateProps';

const LOGO_URL = `file://${path.join(__dirname, '..', 'assets', 'logo.png')}`;

const TEAL = '#3F7B7E';
const TEAL_DARK = '#234C50';

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
            top: '0',
            left: '0',
            right: '0',
            height: '6mm',
            background: `linear-gradient(90deg, ${TEAL} 0%, ${TEAL_DARK} 100%)`,
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: '24mm',
            left: '22mm',
            width: '14mm',
            height: '14mm',
            borderTop: `1.4px solid ${TEAL_DARK}`,
            borderLeft: `1.4px solid ${TEAL_DARK}`,
          }}
        />

        <img
          src={LOGO_URL}
          alt="logo"
          style={{
            position: 'absolute',
            top: '32mm',
            right: '24mm',
            width: '36mm',
            height: '36mm',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: '150mm',
            right: '24mm',
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
                background: TEAL,
                opacity: 0.18,
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
                color: TEAL_DARK,
              }}
            >
              Tax Service
            </div>
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                marginTop: '3mm',
                borderTop: `1.4px solid ${TEAL_DARK}`,
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
              borderBottom: `1.4px solid ${TEAL_DARK}`,
              display: 'inline-block',
              minWidth: '60mm',
              color: '#111',
            }}
          >
            Contract
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '24mm',
            left: '22mm',
            fontFamily: 'Pretendard, sans-serif',
            color: TEAL_DARK,
            fontSize: '36pt',
            fontWeight: 300,
            lineHeight: 1,
            letterSpacing: '0.05em',
          }}
        >
          {'{ }'}
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '24mm',
            right: '24mm',
            textAlign: 'right',
            color: TEAL_DARK,
          }}
        >
          <div
            style={{
              fontSize: '9pt',
              letterSpacing: '0.28em',
              fontWeight: 600,
              marginBottom: '2mm',
            }}
          >
            CORD TAX ACCOUNTING
          </div>
          <div style={{ fontSize: '11pt', letterSpacing: '0.4em', color: TEAL }}>◆ ◆ ◆ ◆</div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            height: '3mm',
            background: `linear-gradient(90deg, ${TEAL_DARK} 0%, ${TEAL} 100%)`,
          }}
        />
      </div>
    </PageFrame>
  );
}
