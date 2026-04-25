import * as React from 'react';
import { Stamp } from './Stamp';

export interface SignatureBlockProps {
  role: string;
  name: string;
  regNo?: string;
  address?: string;
  representative?: string;
  date?: string;
}

const cellLabelStyle: React.CSSProperties = {
  width: '22mm',
  verticalAlign: 'top',
  padding: '1mm 2mm',
  fontWeight: 700,
};
const cellValueStyle: React.CSSProperties = {
  padding: '1mm 2mm',
  verticalAlign: 'top',
};

export function SignatureBlock(props: SignatureBlockProps) {
  return (
    <table
      style={{
        borderCollapse: 'collapse',
        width: '100%',
        fontSize: '10.5pt',
        marginTop: '4mm',
      }}
    >
      <tbody>
        <tr>
          <td style={cellLabelStyle}>{props.role}</td>
          <td style={cellValueStyle}>
            {props.name}
            {props.representative ? ` / 대표자 ${props.representative}` : ''}
            <Stamp />
          </td>
        </tr>
        {props.regNo && (
          <tr>
            <td style={cellLabelStyle}>사업자번호</td>
            <td style={cellValueStyle}>{props.regNo}</td>
          </tr>
        )}
        {props.address && (
          <tr>
            <td style={cellLabelStyle}>주소</td>
            <td style={cellValueStyle}>{props.address}</td>
          </tr>
        )}
        {props.date && (
          <tr>
            <td style={cellLabelStyle}>일자</td>
            <td style={cellValueStyle}>{props.date}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
