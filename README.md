# Greater China Marketing Dashboard — Portfolio Demo

**PORTFOLIO DEMO · SYNTHETIC DATA**

실제 업무에서 설계한 분석 구조와 데이터 트렌드를 기반으로 포트폴리오용으로 재구성한
데모입니다. 표시된 모든 수치는 합성(Synthetic) 데이터이며 실제 회사의 운영 실적을
나타내지 않습니다.

This portfolio demo recreates an analytical framework developed for real-world business
use. All displayed values are synthetic and do not represent actual company performance.

## 무엇을 보여주는가

마케팅 채널 성과를 문의·예약에서 실제 결제까지 연결해 측정하는 Revenue Attribution
구조를 구현한 정적 대시보드입니다.

```
Marketing Data
      ↓
Reservation / Visit Data
      ↓
Payment Data
      ↓
30-Day Attribution Engine
      ↓
Revenue Measurement
```

## 분석 방법론

- **Revenue Attribution** — 결제를 결제일 이전 가장 가까운 qualifying 방문에 귀인
- **30-Day Attribution Window** — 방문일로부터 0~30일 내 발생한 결제만 포함
- **Mature Cohort** — 30일 관찰 기간이 완료된 방문만 성과 측정에 사용
- **Open Cohort** — 관찰 기간이 진행 중인 방문은 별도 집계
- **Visit → Paid Funnel** — 방문 고객 대비 결제 고객 전환율
- **Revenue Reconciliation** — Mature + Open + Unattributed = Total Approved
- **Channel / Nationality Analysis** — 채널별·국가별 기여도 분해
- **PII-safe aggregation** — 집계 지표만 산출, 개인 식별 정보 미포함

## 구성

- `index.html`, `styles.css`, `app.js` — `data/summary.json`만 읽어 렌더링하는 정적 사이트
- `data/summary.json` — 합성 집계 데이터

빌드 과정이 없습니다. GitHub Pages에 그대로 배포됩니다.

## 로컬 확인

```bash
python3 -m http.server 8123
# http://localhost:8123
```

## 데이터에 관하여

이 저장소는 합성 데이터만 포함합니다. 실제 운영 데이터, 원본 파일, 고객 단위 레코드,
개인 식별 정보는 포함되지 않으며 프로덕션 데이터 파이프라인 또한 포함되지 않습니다.
