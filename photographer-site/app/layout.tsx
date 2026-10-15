import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '玉鉴 PHOTO STUDIO · 拍摄前问卷',
  description: '从你喜欢的影像开始。选择人像风格、分享拍摄想法与参考照片，与玉鉴一起准备下一次拍摄。',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({children}: {children: React.ReactNode}) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
