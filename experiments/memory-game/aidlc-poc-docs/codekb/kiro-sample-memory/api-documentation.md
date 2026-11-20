# API Documentation

## External APIs
ไม่มี. ไม่มี HTTP/GraphQL/gRPC endpoint และไม่มีการเรียกเครือข่ายในโค้ด.

## Internal Surfaces
- `export default function App()` ใน `src/App.tsx` ไม่รับ props; ใช้โดย `src/main.tsx` เท่านั้น
- ฟังก์ชันภายในไฟล์ (ไม่ export): `createDeck(): Card[]`

## Browser Storage
ไม่มีการใช้ `localStorage`/`sessionStorage`/cookie ปัจจุบัน.
