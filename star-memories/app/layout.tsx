import type { Metadata,Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'星迹 · 回忆星图',description:'点击一颗星，记下时间、照片和文字。在属于你的星图里，重温每个值得珍藏的瞬间。',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,statusBarStyle:'black-translucent',title:'星迹'},icons:{icon:'/favicon.svg',apple:'/icons/apple-touch-icon.png'}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#080f21'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-CN"><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/><meta name="theme-color" content="#080f21"/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/><meta name="apple-mobile-web-app-title" content="星迹"/></head><body>{children}</body></html>}
