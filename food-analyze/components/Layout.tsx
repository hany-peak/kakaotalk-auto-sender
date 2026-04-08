import React from 'react';
import Link from 'next/link';
import styles from './Layout.module.css'; // We'll create this CSS module next

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div>
      <nav className={styles.navbar}>
        <ul className={styles.navList}>
          <li>
            <Link href="/" className={styles.navLink}>
              제철 농산물 차트
            </Link>
          </li>
          <li>
            <Link href="/sourcing" className={styles.navLink}>
              농가 소싱 리스트
            </Link>
          </li>
          <li>
            <Link href="/call-log" className={styles.navLink}>
              통화 기록
            </Link>
          </li>
        </ul>
      </nav>
      <main className={styles.mainContent}>{children}</main>
    </div>
  );
} 