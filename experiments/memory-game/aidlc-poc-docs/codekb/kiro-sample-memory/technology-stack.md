# Technology Stack

| รายการ | เวอร์ชัน (ตาม `package.json`) | หน้าที่ |
|---|---|---|
| TypeScript | ^5.6.3 | ภาษา, `strict: true`, target ES2020 |
| React / React DOM | ^18.3.1 | UI |
| Vite | ^5.4.11 | dev server และ bundler |
| @vitejs/plugin-react | ^4.3.4 | JSX transform |
| npm | `package-lock.json` | ตัวจัดการแพ็กเกจ |

โมดูลเป็น ESM (`"type": "module"`), `moduleResolution: bundler`, `jsx: react-jsx`. สคริปต์: `dev`, `build` (`tsc && vite build`), `preview`. ไม่มีเฟรมเวิร์กเทสต์ ไม่มี linter.
