# EasyBI (SimpleDash)

Veri setlerini hızlıca dashboard'a dönüştüren, sürükle-bırak bileşenlerle çalışan hafif bir BI aracı.

## Neler sunar
- CSV/XLSX yükleme veya metin yapıştırma ile veri alma
- Sürükle-bırak dashboard düzeni ve çoklu panel yönetimi
- KPI kartları ve grafikler (Recharts)
- Tema yönetimi
- Dışa aktarım: PNG/JPEG/PDF + proje JSON export/import

## Teknoloji
- React 19 + Vite 6
- Tailwind CSS
- Recharts, DnD Kit, Framer Motion
- html2canvas + jsPDF + xlsx

## Kurulum
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Proje Yapısı (özet)
- `App.tsx`: ana akış ve export/import
- `components/`: UI bileşenleri
- `hooks/`: dashboard state yönetimi
- `constants.ts`: tema ve sabitler
