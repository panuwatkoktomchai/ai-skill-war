# Code Structure

## Layout
```
index.html          Static/Asset (entry, lang="th")
package.json        Configuration
tsconfig.json       Configuration (strict, noEmit, include src + vite.config.ts)
vite.config.ts      Configuration (plugin react)
src/main.tsx        Configuration/bootstrap (createRoot, StrictMode)
src/App.tsx         Model + Service + UI (ไฟล์ตรรกะเดียว, ~100 บรรทัด)
src/style.css       Static/Asset (CSS ธรรมดา)
```

## File Classification
- Model: `type Card`, `type Phase` ใน `src/App.tsx`
- Utility: `createDeck` ใน `src/App.tsx`
- Controller/UI: `App` (`flip`, `restart`, JSX) ใน `src/App.tsx`
- Test: ไม่มี

## Patterns
React function component + hooks (`useState`, `useEffect`, `useRef`); ค่าคงที่ระดับโมดูล `EMOJIS`, `PREVIEW_MS`, `MISMATCH_MS`; ชื่อ CSS class: `app`, `status`, `grid`, `card`, `up`, `matched`, `win`, `restart`.
