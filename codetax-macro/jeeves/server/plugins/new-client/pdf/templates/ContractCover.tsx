import * as React from 'react';
import { PageFrame } from './shared/PageFrame';
import { assetDataUrl } from './shared/asset';
import type { TemplateProps } from './shared/TemplateProps';

const COVER_BG_URL = assetDataUrl('cover-bg.png');
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
          background: '#fff',
        }}
      >
        <img
          src={COVER_BG_URL}
          alt="cover"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '210mm',
            height: '297mm',
            objectFit: 'cover',
          }}
        />

        <img
          src={LOGO_WIDE_URL}
          alt="logo"
          style={{
            position: 'absolute',
            bottom: '22mm',
            right: '22mm',
            width: '52mm',
            height: 'auto',
          }}
        />
      </div>
    </PageFrame>
  );
}
