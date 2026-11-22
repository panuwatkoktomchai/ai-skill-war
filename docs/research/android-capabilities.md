# Android ทำอะไรได้จริงบ้าง สำหรับแอป AI ดูแลผู้สูงอายุอยู่คนเดียว

รีเสิร์ชเมื่อ 20 พ.ย. 2569 · ไอเดียที่เกี่ยวข้อง: [../ideas/elderly-alone.md](../ideas/elderly-alone.md)

**วิธีอ่านตาราง:**
- **ความยาก** (คิดจากทีม 3 คน มีเวลา 1 วัน): ง่าย ≈ 1–2 ชม. · กลาง ≈ ครึ่งวัน · ยาก = ไม่ควรทำในวันแข่ง
- **Play risk** มีผลเฉพาะตอนจะขึ้น Play Store จริง วันแข่งลงแอปผ่าน APK ได้เลย ไม่ต้องผ่าน review
- **(ยืนยันไม่ได้)** = ไม่เจอเอกสารทางการ ต้องลองบนเครื่องจริงก่อน

---

## 1. Sensor การเคลื่อนไหว / ตรวจจับการล้ม

| ความสามารถ | API / permission | ทำงานเบื้องหลังได้ไหม | Play risk | ความยาก | ใช้กับผู้สูงอายุ |
|---|---|---|---|---|---|
| Accelerometer / Gyroscope | `SensorManager` ไม่ต้องขอ permission · ถ้าอ่านเร็วเกิน 200Hz ต้องขอ `HIGH_SAMPLING_RATE_SENSORS` | ต้องมี foreground service (FGS) ไม่งั้นไม่ได้รับค่าต่อเนื่อง | ต่ำ | ง่าย | ตรวจจับการล้ม |
| นับก้าว | `TYPE_STEP_COUNTER` + `ACTIVITY_RECOGNITION` | ได้ เพราะ hardware นับไว้ให้ แอปมาอ่านทีหลังได้ | ต่ำ | ง่าย | วันนี้เดินน้อยผิดปกติ |
| Significant motion | `TYPE_SIGNIFICANT_MOTION` | ได้ (ปลุกเครื่องได้) | ต่ำ | ง่าย | เช้านี้ขยับตัวครั้งแรกหรือยัง |
| Activity Recognition (เดิน / นิ่ง / อยู่ในรถ) | Play services + `ACTIVITY_RECOGNITION` | ได้ | ต่ำ | ง่าย | นิ่งนานผิดปกติตอนกลางวัน |
| Sleep API | `requestSleepSegmentUpdates` | ได้ | ต่ำ | กลาง | ตื่นสาย หรือนอนไม่หลับ |
| FGS ประเภท `health` | Android 14+ ต้องขอ `FOREGROUND_SERVICE_HEALTH` คู่กับ runtime permission | ได้ แต่ต้องมี notification ค้างไว้ | กลาง (Play ขอ declaration + วิดีโอ) | กลาง | เปิดตรวจจับการล้มตลอด 24 ชม. |

**ตรวจจับการล้มด้วยมือถือ:**
- ทำได้ แต่ false positive เยอะ เช่น ทำมือถือตก หรือโยนลงโซฟา
- ผู้สูงอายุมักวางมือถือไว้บนโต๊ะ ไม่ได้พกติดตัว
- **วิธีที่เหมาะกับวันแข่ง:**
  1. จับรูปแบบ ตกอิสระ → แรงกระแทกเกิน ~3g → นิ่งเกิน 10 วินาที
  2. AI ถามด้วยเสียงว่า "เป็นอะไรไหมคะ"
  3. ไม่ตอบใน 30 วินาที → แจ้งญาติ
  - ขั้นถามด้วยเสียงคือตัวกรอง false positive
- ยังไม่มีตัวเลข accuracy จากงานวิจัย ถ้าจะใส่สไลด์ต้องหาเพิ่ม

**ตรวจจับการล้มด้วยนาฬิกา:**
- Pixel Watch และ Galaxy Watch โทรฉุกเฉินเองได้ แต่ไม่ส่ง event มาให้แอปบนมือถือ
- ทางเดียวที่เปิดให้คือ Wear OS Health Services (`FALL_DETECTED`) ซึ่งต้องเขียนแอปฝั่งนาฬิกาเอง → ยาก

## 2. Health Connect

| หัวข้อ | รายละเอียด |
|---|---|
| ข้อมูล | ก้าว, heart rate, HRV, การนอน, ความดัน, น้ำตาล, SpO2, อุณหภูมิ, น้ำหนัก, อัตราการหายใจ, exercise, medical records |
| Permission | ขอทีละประเภทข้อมูล · อ่านเบื้องหลังต้องขอ `READ_HEALTH_DATA_IN_BACKGROUND` · อ่านย้อนเกิน 30 วันต้องขอ `READ_HEALTH_DATA_HISTORY` |
| แอปที่เขียนข้อมูลเข้า | Samsung Health, Fitbit, Omron Connect · Xiaomi / Zepp (ยืนยันไม่ได้) |
| Play risk | **สูง** ต้องอธิบายเหตุผลทีละประเภทข้อมูล (ไม่กระทบวันแข่ง) |
| ความยาก | กลาง |
| ใช้กับผู้สูงอายุ | HR ขณะพักสูง + นอนน้อย + เดินน้อย → AI ถามอาการ แล้วสรุปให้ลูกหลาน |

## 3. สัญญาณว่ายังใช้ชีวิตปกติไหม

| ความสามารถ | API / permission | ทำงานเบื้องหลังได้ไหม | Play risk | ความยาก | ใช้กับผู้สูงอายุ |
|---|---|---|---|---|---|
| เปิด/ปิดจอ ปลดล็อก การใช้แอป | `UsageStatsManager` (ผู้ใช้ต้องเปิด `PACKAGE_USAGE_STATS` เอง) | ได้ อ่านย้อนได้ | กลาง | ง่าย | "ไม่แตะมือถือเลยตั้งแต่ 8 โมง" → AI โทรเช็ก |
| ปลดล็อกล่าสุดแบบสด | broadcast `ACTION_USER_PRESENT` | ต้องมี FGS | ต่ำ | ง่าย | |
| แบตเตอรี่ / การชาร์จ | `BatteryManager` ไม่ต้องขอ permission | ได้ | ต่ำ | ง่าย | แบตใกล้หมด → แจ้งลูก · เสียบชาร์จทุกคืน = กิจวัตรปกติ |
| ตำแหน่ง / geofence | Fused Location + Geofencing (`ACCESS_BACKGROUND_LOCATION`) | ได้ | **สูง** (declaration + วิดีโอ) | กลาง | ออกจากบ้านตอนตี 2 / หลงทาง |
| Wi-Fi บ้าน | `ConnectivityManager` (ถ้าจะอ่าน SSID ต้องขอ location) | ได้ | กลาง | ง่าย | รู้ว่าอยู่บ้านโดยไม่ต้องใช้ GPS |

## 4. เสียงและ AI

| ความสามารถ | API | ทำงานเบื้องหลังได้ไหม | ความยาก | หมายเหตุ |
|---|---|---|---|---|
| Speech-to-text ภาษาไทย | `SpeechRecognizer` + `th-TH` (ใช้ online) | ต้องอยู่หน้าจอ หรือมี FGS microphone | ง่าย | ไทยแบบ offline (ยืนยันไม่ได้) |
| Text-to-speech ภาษาไทย | `TextToSpeech` + Google TTS | ได้ | ง่าย | ปรับให้พูดช้าได้ |
| **Gemini Live API** (คุยเสียงสองทาง realtime) | Firebase AI Logic เรียกจากแอปได้เลย ไม่ต้องมี backend | ต้องเปิดแอปไว้ หรือใช้ FGS microphone | **กลาง** | รองรับ th-TH ตาม docs · **แกนของการคุยเช็กอินรายวัน** |
| Gemini API (ข้อความ / รูป / function calling) | Firebase AI Logic | ทำงานบน cloud | ง่าย | agent ประเมินความเสี่ยงแล้วเลือก tool ที่จะเรียก |
| Gemini Nano (AI ในเครื่อง) | ML Kit GenAI / Prompt API | **ไม่ได้** ใช้ได้เฉพาะตอนแอปอยู่หน้าจอ | กลาง | มีแค่บางรุ่น · ภาษาไทยยืนยันไม่ได้ · **ไม่ควรเป็นแกน** |
| คำปลุก (wake word) | ไม่มี API ทางการ · ทางเลือกคือ Picovoice | ต้องมี FGS microphone ค้างไว้ | กลาง-ยาก | ใช้ปุ่มใหญ่แทนดีกว่า |
| AppFunctions (ให้ Gemini เรียกแอปเรา) | Android 16+ · ฝั่ง Gemini ยังเป็น private preview | - | ยาก | เล่าในพิตช์ได้ แต่อย่าสัญญาว่าเดโมได้ |

## 5. ให้ agent ควบคุมมือถือ

| ความสามารถ | API | Play risk | ความยาก | หมายเหตุ |
|---|---|---|---|---|
| AccessibilityService (อ่านจอ / กดแทนผู้ใช้) | ผู้ใช้ต้องเปิดเอง | **สูงมาก** Play ห้ามใช้ทำ automation แบบ autonomous | กลาง | เดโมแบบลง APK ได้ แต่ขึ้น Store ยาก |
| โทรออก | `ACTION_CALL` ใช้ `CALL_PHONE` · `ACTION_DIAL` ไม่ต้องขอ permission | ต่ำ | ง่าย | ล้มแล้วโทรหาลูกให้อัตโนมัติ |
| SMS | `SEND_SMS` ติด policy | **สูง** | ง่าย | **ส่งผ่าน LINE Messaging API ที่ backend แทน** |
| LINE / WhatsApp | ได้แค่ deep link ส่งข้อความอัตโนมัติไม่ได้ | ต่ำ | ง่าย | |
| CallScreeningService | ขอ role `ROLE_CALL_SCREENING` · ได้เบอร์โทรเข้า แต่**ฟังเสียงในสายไม่ได้** | ต่ำ | กลาง | เบอร์ไม่รู้จัก / เบอร์ต่างประเทศ → เตือนว่าอาจเป็นแก๊งคอลเซ็นเตอร์ |
| NotificationListenerService | อ่าน notification จาก LINE / SMS ได้ (Android 15+ ซ่อน OTP) | กลาง | ง่าย | ส่งให้ Gemini จับข้อความหลอก แล้วเตือนด้วยเสียง |
| Scam detection ของ Google | ฝังอยู่ในแอป Phone / Messages ของ Google เอง แอปอื่นเรียกใช้ไม่ได้ ยังไม่มาไทย | - | - | |

## 6. ฉุกเฉิน

| เรื่อง | ความจริง |
|---|---|
| Emergency SOS / ตรวจจับรถชน / Safety check | เป็นฟีเจอร์ของระบบ แอปอื่นสั่งหรือรับ event ไม่ได้ |
| โทร 1669 | `ACTION_CALL` โทรเบอร์ฉุกเฉินไม่ได้ ต้องใช้ `ACTION_DIAL` ให้ผู้ใช้กดโทรเอง · **ออกแบบเป็น: AI โทรหาญาติเองทันที + เปิดหน้าโทร 1669 รอไว้** |
| Emergency Location Service | ระบบส่งตำแหน่งให้หน่วยฉุกเฉินตอนโทรเบอร์ฉุกเฉินเอง · เปิดใช้ในไทยหรือยัง (ยืนยันไม่ได้) |
| Cell Broadcast เตือนภัย | แอปอ่านไม่ได้ ต้องดึงข้อมูลเตือนภัยจาก API ภายนอกเอง (air4thai, กรมอุตุฯ) |

## 7. กล้อง

| ความสามารถ | รายละเอียด | ความยาก |
|---|---|---|
| CameraX | ใช้ได้เฉพาะตอนแอปอยู่หน้าจอ | ง่าย |
| ML Kit อ่านตัวหนังสือ | **ไม่รองรับภาษาไทย** → ใช้ Gemini vision แทน | ง่าย |
| ML Kit ตรวจท่าทาง | จับท่าล้ม / นอนกับพื้น ต้องเปิดกล้องค้างไว้ | กลาง |
| **ถ่ายรูปซองยา** | Gemini อ่านชื่อยา ขนาด และเวลา แล้วตั้งเตือนกินยาให้เอง | ง่าย |

## 8. อุปกรณ์ IoT

| ความสามารถ | รายละเอียด | ความยาก |
|---|---|---|
| อุปกรณ์สุขภาพ BLE | มี GATT มาตรฐานสำหรับ ความดัน 0x1810 · น้ำตาล 0x1808 · อุณหภูมิ 0x1809 · น้ำหนัก 0x181D · SpO2 0x1822 · HR 0x180D แต่หลายยี่ห้อที่ขายในไทยใช้ protocol ของตัวเอง | กลาง-ยาก · **ทางง่ายกว่าคือถ่ายรูปหน้าจอเครื่องวัดความดันให้ Gemini อ่าน** |
| Google Home APIs (Matter) | ใช้ได้กับเซ็นเซอร์ประตู เซ็นเซอร์ตรวจการเคลื่อนไหว ปลั๊กอัจฉริยะ · ยังเป็น beta (GA แล้วหรือยัง ยืนยันไม่ได้) | ยาก |
| Tuya / Xiaomi | Tuya มี Cloud API ทางการ · Xiaomi ไม่มี API ทางการ | กลาง |
| ปุ่ม SOS | ปุ่ม BLE ราคาถูก / Flic SDK | กลาง |
| Wear OS | Data Layer API + Health Services | ยาก |

## 9. แจ้งเตือน

| ความสามารถ | กติกา |
|---|---|
| Exact alarm (เตือนกินยาตรงเวลา) | `SCHEDULE_EXACT_ALARM` ผู้ใช้ต้องเปิดเอง · ทางเลือกคือ `setAlarmClock()` |
| Full-screen intent (เด้งเต็มจอแบบสายเรียกเข้า) | Android 14+ ให้อัตโนมัติเฉพาะแอปโทร / นาฬิกาปลุก · แอปอื่นต้องพาผู้ใช้ไปเปิดเองใน Settings |
| ทะลุโหมดห้ามรบกวน | `ACCESS_NOTIFICATION_POLICY` + `setBypassDnd(true)` |

## 10. UX สำหรับผู้สูงอายุ

| ความสามารถ | รายละเอียด |
|---|---|
| ทำ launcher แทนหน้าโฮม | `RoleManager.ROLE_HOME` ไม่ติด policy |
| ตัวหนังสือใหญ่ | Android 14+ ขยายได้ถึง 200% · UI ต้องใช้หน่วย `sp` และทดสอบที่ 200% |
| Kiosk / lock task | ต้องตั้งเครื่องเป็น device owner ผ่าน adb บนเครื่องเดโม |
| Samsung Easy mode / Simple view | เป็นการตั้งค่าของระบบ แอปเปิดให้เองไม่ได้ |

---

## 10 อย่างที่ทำได้ใน 1 วันและน่าจะทำให้กรรมการ wow

1. **คุยเช็กอินด้วยเสียงทุกเช้า (Gemini Live ภาษาไทย):** ถามเรื่องการนอน การกินยา ความรู้สึก แล้วให้คะแนนความเสี่ยง (กลาง)
2. **ตรวจจับการล้ม + ถามยืนยันด้วยเสียง:** ไม่ตอบ → แจ้งญาติ (กลาง)
3. **แจ้งญาติผ่าน LINE Messaging API** (ง่าย)
4. **ปุ่ม SOS ใหญ่:** โทรหาลูก + เปิดหน้าโทร 1669 (ง่าย)
5. **คะแนน "วันนี้ปกติดีไหม" ทุกวัน:** คำนวณจากเวลาปลดล็อก จำนวนก้าว การชาร์จ และ Wi-Fi บ้าน (ง่าย-กลาง)
6. **ถ่ายรูปซองยาภาษาไทย → ตั้งเตือนกินยาให้เอง** (ง่าย)
7. **จับข้อความหลอกใน LINE / SMS → เตือนด้วยเสียง** (ง่าย-กลาง)
8. **เตือนสายแปลกด้วย CallScreeningService** (กลาง)
9. **เตือนภัยเมืองตามพิกัดบ้าน:** ฝุ่น / ร้อนจัด / น้ำท่วม พูดเตือนด้วยเสียง และแจ้งญาติ (ง่าย)
10. **ค่าความดันจากรูปถ่ายหรือ Health Connect → แสดงแนวโน้มให้ลูกหลานดู** (ง่าย)

## อย่าทำ / ติด policy

- ❌ AccessibilityService ให้ AI กดแอปอื่นเอง (ใช้ได้แค่ตอนเดโม)
- ❌ `SEND_SMS` / อ่าน call log → ใช้ LINE แทน
- ❌ หวังให้ `ACTION_CALL` โทร 1669 ได้เอง → ใช้ `ACTION_DIAL`
- ❌ รับ event ล้ม / SOS จากนาฬิกา Pixel / Galaxy มาที่แอปมือถือ
- ❌ ฟังเสียงในสายโทรเข้า-ออก
- ❌ ใช้ Gemini Nano เป็นแกน
- ❌ ใช้ ML Kit OCR อ่านภาษาไทย
- ❌ ตั้ง wake word ภาษาไทยให้ฟังตลอด
- ❌ พึ่ง AppFunctions
- ⚠️ background location, Health Connect, FGS health และ full-screen intent ต้องกรอก declaration ตอนขึ้น Store · ถ้าพูดในพิตช์ว่าเรารู้ ทีมจะดูพร้อมกว่า

## ต้องลองบนเครื่องจริงก่อนวันแข่ง

- STT ภาษาไทยแบบ offline
- Gemini Live ผ่าน Firebase พูดไทยได้จริงไหม
- 1669 อยู่ในรายชื่อเบอร์ฉุกเฉินของเครื่องไหม
- Mi Fitness เขียนข้อมูลเข้า Health Connect ไหม
- Google Home APIs ออก GA แล้วหรือยัง

## แหล่งข้อมูล

**AI ในเครื่อง / Gemini:**
- ML Kit GenAI: https://developers.google.com/ml-kit/genai
- Prompt API: https://developer.android.com/blog/posts/ml-kit-s-prompt-api-unlock-custom-on-device-gemini-nano-experiences
- AppFunctions: https://developer.android.com/ai/appfunctions · https://android-developers.googleblog.com/2026/02/the-intelligent-os-making-ai-agents.html
- Gemini Live: https://developer.android.com/ai/gemini/live
- ภาษาที่ Live API รองรับ: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/configure-language-voice
- Firebase AI Logic: https://firebase.google.com/docs/ai-logic/live-api/configuration
- เสียงไทยใน Live API (forum): https://discuss.ai.google.dev/t/gemini-live-api-default-voice/147006

**Policy / ข้อจำกัดของ Play และ Android:**
- Accessibility: https://support.google.com/googleplay/android-developer/answer/10964491
- Full-screen intent: https://support.google.com/googleplay/android-developer/answer/13392821
- Android 16: https://developer.android.com/about/versions/16/behavior-changes-16
- FGS: https://developer.android.com/develop/background-work/services/fgs/changes

**Health Connect:**
- อ่านข้อมูล: https://developer.android.com/health-and-fitness/health-connect/read-data
- ประกาศสิทธิ์: https://developer.android.com/health-and-fitness/guides/health-connect/publish/declare-access

**นาฬิกา / บ้านอัจฉริยะ / scam:**
- Galaxy Watch fall: https://developer.samsung.com/health/blog/en/events-monitoring
- Google Home APIs: https://developers.home.google.com/apis
- Scam detection ของ Google: https://blog.google/security/new-ai-powered-scam-detection-features/
