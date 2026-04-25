import * as React from 'react';

export function Stamp({ size = '11pt' }: { size?: string }) {
  return (
    <span style={{ fontSize: size, fontWeight: 700, marginLeft: '4mm' }}>(인)</span>
  );
}
