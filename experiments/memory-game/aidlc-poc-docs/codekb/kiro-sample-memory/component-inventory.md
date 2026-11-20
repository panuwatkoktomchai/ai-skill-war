# Component Inventory

## App
- ที่อยู่: `src/App.tsx`
- หน้าที่: ถือ state เกมทั้งหมด, จัดการ phase, เรนเดอร์หัวเรื่อง สถานะ ตารางการ์ด และกล่องชนะ
- ขึ้นกับ: `react` (`useEffect`, `useRef`, `useState`), `createDeck`

## createDeck
- ที่อยู่: `src/App.tsx`
- หน้าที่: สร้างและสลับเด็ค 12 ใบจาก `EMOJIS` สองชุด (Fisher-Yates)
- ขึ้นกับ: `Math.random`

## main bootstrap
- ที่อยู่: `src/main.tsx`
- หน้าที่: mount `App` ที่ `#root` ใน `StrictMode`, import `src/style.css`
- ขึ้นกับ: `react`, `react-dom/client`, `App`
