# Dependencies

เวอร์ชันและบทบาทดู `technology-stack.md`.

## External
- Runtime: `react`, `react-dom`
- Dev: `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `typescript`, `vite`

## Internal
`src/main.tsx` → `src/App.tsx`, `src/style.css`. `src/App.tsx` ไม่ import ไฟล์ภายในอื่น. ไม่มี circular reference.

## Browser APIs ที่ใช้
`window.setTimeout`, `clearTimeout`, `Math.random`, DOM `document.getElementById`.
