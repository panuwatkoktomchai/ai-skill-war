# Kiro + AI-DLC สรุปไว้อ่านทวน (20 พ.ย. 2569)

สรุปจาก doc ทางการของ kiro.dev และ awslabs/aidlc-workflows ที่เปิดอ่านวันนี้ ส่วนไหนยังไม่ได้ยืนยันจะเขียนกำกับไว้

---

## 1. สองอย่างนี้คืออะไร ต่างกันยังไง

| | Kiro | AI-DLC |
|---|---|---|
| เป็น | **IDE** (โปรแกรมเขียนโค้ด) ของ AWS ที่มี AI agent ในตัว หน้าตาแบบ VS Code มีทั้ง IDE และ CLI | **วิธีทำงาน** (methodology) ของ AWS ว่าควรสร้างซอฟต์แวร์กับ AI ยังไง |
| เทียบให้เห็นภาพ | เหมือน Cursor หรือ Claude Code | เหมือน Scrum แต่ออกแบบมาให้ AI เป็นตัวขับ |
| ของที่จับต้องได้ | Specs, Steering, Hooks, Powers | ชุด rule/skill จาก repo `awslabs/aidlc-workflows` ที่ลงใน Kiro แล้วสั่งด้วย `/aidlc` |

**สรุปสั้นๆ:** Kiro คือเครื่องมือ ส่วน AI-DLC คือขั้นตอนการทำงานที่ติดตั้งลงใน Kiro ให้ agent เดินตาม

---

## 2. AI-DLC (AI-Driven Development Life Cycle)

### แนวคิดหลัก

- **AI เป็นคนเริ่มและนำบทสนทนา ส่วนคนเป็นคนตัดสินใจ**
  - SDLC แบบเดิม: คนเขียน requirement แล้วสั่ง AI ช่วยเขียนโค้ดเป็นจุดๆ
  - AI-DLC: AI แตกงาน วางแผน และถามคำถามที่ต้องเคลียร์ก่อน แล้วคนเป็นคนยืนยัน
- **ทุกขั้นจบด้วย approval gate:** AI จะหยุดรอคนอนุมัติก่อนไปขั้นต่อไปเสมอ
- **ไม่ได้เอา AI มาแปะกับ Scrum:** สร้างกระบวนการใหม่ให้รอบงานสั้นลงเป็นชั่วโมงหรือวัน แทน sprint 2 สัปดาห์

### ศัพท์ที่วิทยากรน่าจะพูดถึง

| คำ | ความหมาย |
|---|---|
| **Intent** | ความตั้งใจหรือโจทย์ทางธุรกิจที่ป้อนเข้าไป เช่น "ระบบเช็กอินผู้สูงอายุอยู่คนเดียว" |
| **Unit of Work** | ก้อนงานที่ AI แตกออกมาจาก Intent มีลำดับก่อนหลังกำหนดไว้ (dependency) |
| **Bolt** | รอบการส่งมอบที่สั้นเป็นชั่วโมงหรือวัน ใช้แทน sprint |
| **Mob Elaboration** | ทั้งทีมนั่งตรวจ requirement และ user story ที่ AI ร่างพร้อมกันในห้องเดียว |
| **Mob Construction** | ทั้งทีมช่วยตัดสินเรื่องเทคนิคตอน AI เสนอ design และโค้ด |

Mob Elaboration, Mob Construction และ Bolt มาจากบทความ AWS และบล็อกที่สรุปต่อ ผมเปิดตัวบทความต้นฉบับของ AWS ไม่ขึ้น

### ช่วงหลักของงาน

AWS พูดถึง 3 ช่วง:

1. **Inception (คิดและออกแบบ):** AI แปลงความตั้งใจเป็น requirement, user story และการแบ่ง unit ทีมตรวจด้วยกันแบบ Mob Elaboration
2. **Construction (สร้าง):** AI เสนอ design, โค้ด และเทสต์ ทีมช่วยตัดสินเรื่องเทคนิค
3. **Operations (ขึ้นระบบและดูแล):** deploy, monitor, ปรับปรุง ส่วนนี้ AWS ยังเขียนไว้บางที่สุด

### เวอร์ชันปัจจุบันใน repo (v2.11.4) แบ่งละเอียดกว่านั้น: 5 phase 33 stage

| Phase | Stage หลัก (ALWAYS = ทำทุกครั้ง · C = ทำเมื่อจำเป็น) |
|---|---|
| 0 Initialization | Workspace Scaffold · Workspace Detection · State Initialization (ทำอัตโนมัติ ไม่มี gate) |
| 1 Ideation | Intent Capture & Framing (ALWAYS) · Market Research (C) · Feasibility (C) · Scope Definition (ALWAYS) · Team Formation (C) · Rough Mockups (C) · Approval & Handoff (ALWAYS) |
| 2 Inception | Reverse Engineering (เฉพาะโค้ดเดิม) · Practices Discovery (C) · **Requirements Analysis** (ALWAYS, `requirements.md`) · **User Stories** (`stories.md`, `personas.md`) · Refined Mockups (C) · Domain Design (`components.md`, `decisions.md`) · **Units Generation** (ALWAYS) · Contract Design (C) · Delivery Planning (ALWAYS) |
| 3 Construction | Functional Design · NFR Requirements · NFR Design · Infrastructure Design (ทำต่อ unit ตามความจำเป็น) · **Code Generation** (ทุก unit) · **Build and Test** (ครั้งเดียวตอนจบ) · CI Pipeline (C) |
| 4 Operation | Deployment Pipeline ถึง Feedback & Optimization (ทุก stage เป็น C) |

### Scope: ตัวกำหนดว่าจะเดินกี่ stage

ต้องเลือก scope ให้ถูกตั้งแต่ต้น ไม่งั้นวันเดียวไม่จบ

| Scope | Ideation | Operation | เหมาะกับ |
|---|---|---|---|
| `poc` | 1 stage (Intent Capture) | ไม่ทำ | **hackathon / พิสูจน์ไอเดีย** |
| `mvp` | 4 stage | ไม่ทำ | ของที่จะใช้จริงรอบแรก |
| `classic` | ข้าม | ไม่ทำ | |
| `feature` / `enterprise` | ครบ 7 stage | ทำ | งานใหญ่ |

### คำสั่งที่ใช้บ่อย

```text
/aidlc --doctor                      เช็กว่าติดตั้งครบ
/aidlc <โจทย์>                       เริ่มงาน เช่น /aidlc build a to-do app
/aidlc --stage <ชื่อ>  /  --phase    กระโดดไป stage หรือ phase ที่ต้องการ
/aidlc --single                      ทำ stage เดียวโดยไม่เดิน workflow ต่อ
/aidlc park  →  /aidlc --resume      พักงานแล้วไปต่อในแชตใหม่ (ใช้ตอนแชตใกล้เต็ม ~80%)
```

ผลงานที่ AI-DLC สร้างเก็บอยู่ในโฟลเดอร์ `aidlc/` ข้าง `.kiro/`:
- `aidlc-state.md` บอกว่าตอนนี้ถึง stage ไหน
- `audit/` เก็บประวัติการตัดสินใจ
- เอกสารของแต่ละ intent อยู่ที่ `aidlc/spaces/<space>/intents/<วันที่>-<ชื่อ>/`

⚠️ บล็อกรุ่นเก่าเขียนว่าใช้ `aidlc-docs/` กับ `audit.md` ซึ่งไม่ตรงกับเวอร์ชันปัจจุบันแล้ว ถ้าแล็บในเวิร์กช็อปสอนแบบเก่า ให้ทำตามวิทยากร

### ติดตั้งบน Kiro IDE (ตาม doc ปัจจุบัน)

```bash
tmp="$(mktemp -d)" && curl -fsSL https://github.com/awslabs/aidlc-workflows/releases/latest/download/install.sh -o "$tmp/install.sh" && sh "$tmp/install.sh" && rm -rf "$tmp"
cd <โปรเจกต์>
aidlc config --harness kiro
aidlc doctor
```

จากนั้นใน Kiro:
1. เปิดโปรเจกต์ แล้วกด Trust folder ที่แถบ Restricted Mode
2. รัน Developer: Reload Window
3. เลือก agent ชื่อ **aidlc** ในช่องแชต
4. พิมพ์ `/aidlc --doctor`

ข้อควรรู้:
- ต้องใช้ Kiro IDE 1.1.70 ขึ้นไป หรือ Kiro CLI 2.24.1 ขึ้นไป
- doc แนะนำโมเดลระดับ Claude Opus เพราะโมเดลที่อ่อนกว่าจะข้ามขั้นตรวจทานและข้าม gate
- ฟีเจอร์ Workflows ของ Kiro เองชนกับ AI-DLC ตอนเริ่ม AI-DLC จะถามว่าให้ปิดไหม

---

## 3. Kiro: 4 ฟีเจอร์หลัก (Specs · Steering · Hooks · Powers)

### Specs: ให้ AI เขียนแผนก่อนเขียนโค้ด

- **Feature Spec** สร้าง 3 ไฟล์ แล้วไล่ทำทีละไฟล์
  - `requirements.md`: user story กับเกณฑ์ผ่านงาน
  - `design.md`: สถาปัตยกรรม
  - `tasks.md`: งานย่อยที่ติ๊กเสร็จได้
- **ลำดับ:** Requirements-First (requirement → design → task) หรือ Design-First ก็ได้
- **EARS** คือรูปแบบประโยคเขียน requirement: `WHEN [เหตุการณ์] THE SYSTEM SHALL [สิ่งที่ระบบต้องทำ]`
  - ตัวอย่าง: WHEN ผู้สูงอายุไม่ตอบภายใน 30 นาที THE SYSTEM SHALL แจ้งลูกหลาน
- **tasks.md** จัดงานเป็นระลอก (wave) งานในระลอกเดียวกันรันพร้อมกันได้
- **Bugfix Spec** สร้าง `bugfix.md` เขียน 3 อย่าง: ตอนนี้เป็นยังไง ควรเป็นยังไง และอะไรห้ามเปลี่ยน
- **Quick Spec** สร้างทั้ง 3 ไฟล์ทีเดียว ไม่มี gate ถ้ารีบให้ใช้อันนี้
- ส่วน **Vibe mode** คือคุยแล้วเขียนโค้ดเลยไม่ผ่าน spec

### Steering: ความรู้ถาวรที่ agent อ่านทุกครั้ง

- คล้าย `CLAUDE.md` ของเรา
- ที่อยู่:
  - `.kiro/steering/*.md` ใช้เฉพาะโปรเจกต์ (ถ้าขัดกับ global ฝั่งนี้ชนะ)
  - `~/.kiro/steering/` ใช้ทุกโปรเจกต์
- ไฟล์ตั้งต้น 3 ไฟล์ กดปุ่ม Generate Steering Docs ให้สร้างให้ได้
  - `product.md`: ทำอะไร ให้ใคร
  - `tech.md`: ใช้ stack อะไร
  - `structure.md`: โครงโฟลเดอร์
- กำหนดว่าจะโหลดไฟล์เมื่อไหร่ด้วย front matter บนหัวไฟล์:
  - `inclusion: always` โหลดทุกครั้ง (ค่าตั้งต้น)
  - `inclusion: fileMatch` + `fileMatchPattern: "src/api/**"` โหลดเมื่อแตะไฟล์ที่ตรง pattern
  - `inclusion: manual` เรียกเองในแชตด้วย `#ชื่อไฟล์`
  - `inclusion: auto` ให้ agent เลือกเองจาก `description`
- `AGENTS.md` ถูกอ่านทุกครั้งเหมือนกัน
- **AI-DLC เดิมทีติดตั้งตัวเองเป็น steering:** เวอร์ชันใหม่ใช้ skill และ agent แทน

### Hooks: ให้ AI ทำงานอัตโนมัติเมื่อเกิดเหตุการณ์

- อยู่ที่ `.kiro/hooks/<id>.json` ระบุ 3 อย่าง:
  - trigger: เหตุการณ์ที่ทำให้ hook ทำงาน
  - matcher: กรองว่าเป็นไฟล์หรือ tool ไหน
  - action: รันคำสั่ง หรือส่ง prompt ให้ agent
- ตัวอย่าง: `PostFileSave` บนไฟล์ `.ts/.tsx` → รัน `npx eslint --fix`
- trigger อื่นที่ doc พูดถึง:
  - `Stop`: ตอน agent ทำงานจบ
  - `PreToolUse` / `PostToolUse`: ก่อนหรือหลัง agent เรียกเครื่องมือ
- สร้าง hook ได้ด้วยการพิมพ์บอก agent ในแชต

### Powers: แพ็กความรู้เฉพาะทางแบบเสียบใช้

- รวม MCP server, skill และ steering ของบริการหนึ่งไว้ในแพ็กเดียว เช่น Stripe, Supabase, Figma, Netlify, Postman, Datadog
- **โหลดเฉพาะตอนที่ใช้:** Power จะโหลดเมื่อในงานมีคีย์เวิร์ดตรง เช่นพิมพ์ว่า "payment" แล้ว Power ของ Stripe ขึ้นมา พอเปลี่ยนเรื่องก็ถอดออก ติดตั้งไว้เยอะแค่ไหน context ก็ไม่บวม
- **โครงไฟล์:**
  - แบบใหม่: `plugin.json` (มี keywords) + `skills/` + `mcp.json`
  - แบบเก่า: `POWER.md` ยังใช้ได้
- ติดตั้งได้ 3 ทาง: แผง Powers ใน IDE, kiro.dev/powers หรือลิงก์ GitHub ไม่เสียเงินเพิ่ม
- ⚠️ Kiro ไม่ได้ตรวจ Power ของบุคคลที่สาม ควรลงเฉพาะของเจ้าที่ไว้ใจได้

### อื่นๆ ที่ควรรู้

- **โหมดควบคุม agent** (Kiro IDE 1.4.154 ขึ้นไป) มี 3 โหมด:
  - Supervised: ถามก่อนทุกครั้ง
  - Accept file changes: เดิมชื่อ Autopilot
  - Approve for me: อนุมัติให้เอง
  - ตอนใช้ AI-DLC จะหยุดที่ gate เสมอไม่ว่าเลือกโหมดไหน
- **MCP:** ตั้งค่าที่ `.kiro/settings/mcp.json`
- **โมเดล:** มี Auto (ค่าตั้งต้น) · Claude Opus 5.5 (ใช้เครดิต 2 เท่า) · Sonnet 5.5 (1.3 เท่า) · Haiku 5.5 (0.06 เท่า) · GPT-5.6 · โมเดล open-weight อีกหลายตัว

### ราคา (kiro.dev/pricing)

| แผน | ราคา/เดือน | เครดิต |
|---|---|---|
| Free | $0 | 50 (open-weight + Sonnet 4.5) |
| Pro | $20 | 1,000 |
| Pro+ | $40 | 2,000 |
| Pro Max | $100 | 5,000 |
| Power | $200 | 10,000 |

- ซื้อเครดิตเพิ่มได้ เครดิตละ $0.04
- อัปเป็น Pro ครั้งแรก ได้ใช้ฟรีถึงสิ้นเดือน และได้เครดิตทดลองอีก 500
- task จาก spec หนึ่งอันมักใช้เกิน 1 เครดิต

---

## 4. นำมาใช้วันแข่ง (30 พ.ย.)

1. **ของที่ต้องเช็กก่อนวันแข่ง:**
   - **เครดิต:** แผน Free ได้ 50 เครดิตต่อเดือน เดิน AI-DLC รอบเดียวอาจหมด ควรอัปเป็น Pro อย่างน้อย 1 บัญชี (ได้ 500 เครดิตทดลอง) หรือถามผู้จัดว่าแจกเครดิตไหม เพราะรางวัลมีเครดิต Kiro อยู่แล้ว
   - **ติดตั้งและทดสอบ:** ลง AI-DLC กับ `/aidlc --doctor` ให้ผ่านก่อนวันแข่ง
   - **เตรียม steering ไว้ก่อน:** `product.md` (โจทย์ผู้สูงอายุ), `tech.md` (stack ที่เลือก) และ `structure.md` วันแข่งจะได้ไม่ต้องเสียเวลาอธิบาย
2. **ในวันแข่ง:**
   - ใช้ `/aidlc --scope poc` หรือ `mvp` ([ยังไม่ได้ยืนยันชื่อ flag] ต้องเช็กใน `/aidlc --help`)
   - เดิน Inception ให้เร็ว ไม่เกิน 1 ชั่วโมง แล้วรีบไป Code Generation
   - Mob Elaboration ใช้ได้จริง: นั่ง 3 คนตรวจ requirement และ user story ที่ AI ร่างพร้อมกัน
   - ถ้าแชตใกล้เต็มให้ `park` แล้ว `resume` อย่าปล่อยให้ context ล้น
3. **เอาไปใช้ตอน pitch:** สไลด์ไหนต้องบอกว่าทำอย่างเป็นระบบ ให้หยิบไฟล์ `requirements.md`, `stories.md` และ `audit/` ที่ AI-DLC สร้างไปโชว์ได้เลย กรรมการจาก AWS น่าจะชอบ

## 5. คำถามที่ควรถามวิทยากรวันนี้

- วันแข่ง **ต้องใช้** Kiro หรือ AI-DLC ไหม หรือใช้เครื่องมืออื่นร่วมได้ (เช่น Claude Code) และกรรมการให้คะแนนการใช้ AI-DLC ด้วยไหม
- ผู้จัดแจกเครดิต Kiro หรือ AWS credits ให้ทีมไหม
- ต้องใช้บริการ AWS อะไรเป็นข้อบังคับไหม (Bedrock, Transcribe, Polly)
- ถ้าแล็บสอน AI-DLC เวอร์ชันไหน จะได้ติดตั้งให้ตรงกับที่วิทยากรสอน

---

**ที่มา:**
- https://kiro.dev/docs/specs/
- https://kiro.dev/docs/steering/
- https://kiro.dev/docs/hooks/
- https://kiro.dev/docs/powers/
- https://kiro.dev/blog/introducing-powers/
- https://kiro.dev/pricing/
- https://kiro.dev/docs/models/available-models/
- https://github.com/awslabs/aidlc-workflows
- https://awslabs.github.io/aidlc-workflows/guide/harnesses/kiro/
- https://awslabs.github.io/aidlc-workflows/guide/04-phases-and-stages/
- บทสรุป AI-DLC ของบุคคลที่สาม: https://brights.io/blog/ai-driven-development-life-cycle · https://jellyfish.co/library/ai-driven-development-lifecycle/
