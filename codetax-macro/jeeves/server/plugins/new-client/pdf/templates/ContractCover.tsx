import * as React from 'react';
import { PageFrame } from './shared/PageFrame';
import { assetDataUrl } from './shared/asset';
import type { TemplateProps } from './shared/TemplateProps';

const COVER_BG_URL = assetDataUrl('cover-bg.png');

export function ContractCover(_props: TemplateProps) {
  return (
    <PageFrame margin={{ top: '0', right: '0', bottom: '0', left: '0' }}>
      <img
        src={COVER_BG_URL}
        alt="cover"
        style={{
          display: 'block',
          width: '210mm',
          height: '297mm',
          objectFit: 'cover',
        }}
      />
    </PageFrame>
  );
}
