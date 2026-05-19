import "./globals.css";

export const metadata = {
  title: "未见之画",
  description: "一个向盲人描述名画并生成想象画的 AI 原生游戏原型。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
