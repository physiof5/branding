import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '가격대별 매물대·수급·공시 분석',
  description: '과거 체결 거래량 분포와 공개 공시·수급 데이터를 가격 구간별로 시각화한 참고용 웹앱',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-gray-100">{children}</body>
    </html>
  );
}
