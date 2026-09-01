import { useState } from 'react'
import {
  AdjustmentsHorizontalIcon, ArrowLeftIcon, ArrowRightIcon, BookOpenIcon,
  CalendarDaysIcon, CameraIcon, CheckIcon, ChevronRightIcon,
  EllipsisHorizontalIcon, HomeIcon, ListBulletIcon, MapPinIcon,
  MapIcon, PlusIcon, SparklesIcon,
} from '@heroicons/react/24/outline'
import './PrototypeLab.css'

const views = [
  ['home', '홈', HomeIcon, '지금 해야 할 일'],
  ['plan', '하루 만들기', PlusIcon, '계획이 시작되는 순간'],
  ['today', '오늘의 하루', MapIcon, '다음 장소에 집중'],
  ['records', '기록', BookOpenIcon, '지난 하루 다시 보기'],
]

const places = [
  ['14:00', '그라운드시소 성수', '전시 관람'],
  ['17:10', '서울숲 산책길', '천천히 걷고 사진 남기기'],
  ['19:00', '작은식당 성수점', '창가 자리 예약'],
]

export default function PrototypeLab() {
  const [platform, setPlatform] = useState('web')
  const [screen, setScreen] = useState('home')
  const [planStep, setPlanStep] = useState(1)
  const move = (next) => {
    setScreen(next)
    if (next !== 'plan') setPlanStep(1)
  }

  return (
    <main className="daybook-lab">
      <header className="lab-heading">
        <div><span>UX REDESIGN 02</span><h1>장소 기반 데이북</h1><p>하루가 계획에서 기억으로 바뀌는 흐름을 검토합니다.</p></div>
        <a href="/legacy-home">기존 서비스 화면</a>
      </header>
      <div className="lab-layout">
        <aside className="review-panel">
          <div className="review-title"><AdjustmentsHorizontalIcon /><p><b>경험 구조 검토</b><small>색상보다 흐름을 먼저 봅니다</small></p></div>
          <label>플랫폼</label>
          <div className="segment">
            <button className={platform === 'app' ? 'on' : ''} onClick={() => setPlatform('app')} type="button">모바일</button>
            <button className={platform === 'web' ? 'on' : ''} onClick={() => setPlatform('web')} type="button">웹</button>
          </div>
          <label>핵심 순간</label>
          <div className="view-picker">
            {views.map(([id, title, Icon, note], index) => (
              <button className={screen === id ? 'on' : ''} key={id} onClick={() => move(id)} type="button">
                <i>{index + 1}</i><Icon /><p><b>{title}</b><small>{note}</small></p>
              </button>
            ))}
          </div>
          <div className="principle"><SparklesIcon /><p><b>핵심 기준</b><span>예정 화면은 장소와 행동을, 완료 화면은 사진과 기억을 먼저 보여줍니다.</span></p></div>
        </aside>
        <section className={`preview preview--${platform}`}>
          <div className="preview-meta"><span>{platform === 'app' ? '모바일 메인 경험 · 390px' : '웹 보조 경험 · 1280px'}</span><b>{views.find(([id]) => id === screen)?.[1]}</b></div>
          <Device platform={platform} screen={screen} move={move} planStep={planStep} setPlanStep={setPlanStep} />
        </section>
      </div>
    </main>
  )
}

function Device({ platform, screen, move, planStep, setPlanStep }) {
  return (
    <div className={`device device--${platform}`}>
      {platform === 'app' && <div className="sensor" />}
      {platform === 'web' && <SideNav screen={screen} move={move} />}
      <section className={`product ${screen === 'plan' ? 'focus' : ''}`}>
        <ProductHeader screen={screen} move={move} compact={platform === 'app'} />
        <div className="product-body">
          {screen === 'home' && <Home move={move} />}
          {screen === 'plan' && <Plan step={planStep} setStep={setPlanStep} move={move} />}
          {screen === 'today' && <Today move={move} />}
          {screen === 'records' && <Records />}
        </div>
        {platform === 'app' && screen !== 'plan' && <BottomNav screen={screen} move={move} />}
      </section>
    </div>
  )
}

function ProductHeader({ screen, move, compact }) {
  if (screen === 'plan') return <header className="product-head focus-head"><button aria-label="닫기" onClick={() => move('home')} type="button"><ArrowLeftIcon /></button><b>새로운 하루</b><i /></header>
  return (
    <header className="product-head">
      <button className="space-switch" type="button"><Avatars /><p><b>우리 둘의 하루</b>{!compact && <small>함께 만드는 데이북</small>}</p><ChevronRightIcon /></button>
      <button className="new-day" onClick={() => move('plan')} type="button"><PlusIcon />{!compact && '하루 만들기'}</button>
    </header>
  )
}

function SideNav({ screen, move }) {
  const nav = [['home','홈',HomeIcon],['calendar','캘린더',CalendarDaysIcon],['plan','일정',ListBulletIcon],['records','기록',BookOpenIcon],['more','더보기',EllipsisHorizontalIcon]]
  return (
    <aside className="side-nav">
      <div className="brand"><i>내</i><p><b>나의 일기</b><small>장소 기반 데이북</small></p></div>
      <div className="side-space"><Avatars /><p><b>우리 둘의 하루</b><small>홍섭님 · 민지님</small></p></div>
      <nav>{nav.map(([id,label,Icon]) => <button className={screen === id ? 'on' : ''} key={id} onClick={() => ['home','plan','records'].includes(id) && move(id)} type="button"><Icon />{label}</button>)}</nav>
      <blockquote>앞으로의 하루와<br />지나간 기억이 한곳에.</blockquote>
    </aside>
  )
}

function Home({ move }) {
  return (
    <div className="home-view">
      <section className="day-hero">
        <div><span className="eyebrow">오늘 · 9월 1일 화요일</span><h2>오늘은 성수에서<br />천천히 보내요.</h2><p className="together"><Avatars />민지님과 함께 · 오후 2시 시작</p><button onClick={() => move('today')} type="button">오늘의 하루 보기<ArrowRightIcon /></button></div>
        <Photo className="photo-hero" label="성수의 오늘" />
      </section>
      <section className="route-card">
        <Title eyebrow="TODAY ROUTE" title="세 곳을 함께 가요"><b>1 / 3 방문</b></Title>
        <div className="route-line">{places.map((place,index) => <div className={index === 0 ? 'done' : index === 1 ? 'active' : ''} key={place[1]}><i>{index === 0 ? <CheckIcon /> : index + 1}</i><p><b>{place[1]}</b><small>{place[0]}</small></p></div>)}</div>
      </section>
      <section className="record-prompt"><Photo className="photo-prompt" /><div><span className="eyebrow">기록 대기</span><h3>한강의 노을을 남겨볼까요?</h3><p>사진 한 장이나 한 문장으로 시작해도 충분해요.</p></div><button onClick={() => move('records')} type="button">남기기</button></section>
    </div>
  )
}

function Plan({ step, setStep, move }) {
  if (step === 2) return (
    <div className="plan-view">
      <Progress step={2} />
      <Heading eyebrow="STEP 2 · 갈 곳 정하기" title={<>이 하루에<br />어디를 담아볼까요?</>} text="장소를 고른 순서가 그날의 흐름이 됩니다." />
      <button className="search-place" type="button"><MapPinIcon />카페, 전시, 식당을 검색해 보세요</button>
      <div className="plan-grid"><div className="selected-places">{places.map((place,index) => <article key={place[1]}><i>{index + 1}</i><p><b>{place[1]}</b><small>{place[2]}</small></p><EllipsisHorizontalIcon /></article>)}<button type="button"><PlusIcon />장소 추가</button></div><MapPreview /></div>
      <div className="form-actions"><button onClick={() => setStep(1)} type="button">이전</button><button className="primary" onClick={() => move('home')} type="button">하루 완성하기<CheckIcon /></button></div>
    </div>
  )
  return (
    <div className="plan-view">
      <Progress step={1} />
      <Heading eyebrow="STEP 1 · 하루 만들기" title={<>어떤 하루를<br />보내고 싶나요?</>} text="세부 일정표보다 그날의 모습을 먼저 떠올려 보세요." />
      <div className="day-form">
        <Field label="하루의 이름">성수 전시와 저녁</Field>
        <div className="form-row"><Field label="날짜">2026. 09. 01</Field><Field label="시간">14:00 – 20:30</Field></div>
        <Field label="함께하는 공간"><span className="space-value"><Avatars /><span><b>우리 둘의 하루</b><small>홍섭님 · 민지님</small></span><ChevronRightIcon /></span></Field>
        <Field label="한 줄 메모 · 선택">전시 보고 저녁 먹기. 서두르지 않기.</Field>
      </div>
      <div className="form-actions"><button className="primary" onClick={() => setStep(2)} type="button">갈 곳 정하기<ArrowRightIcon /></button></div>
    </div>
  )
}

function Today({ move }) {
  return (
    <div className="today-view">
      <Heading eyebrow="● 오늘 진행 중" title="다음은 서울숲이에요." text="오후 5시 10분 · 걸어서 약 12분" />
      <div className="today-grid"><section className="next-place"><Photo className="photo-forest" label="다음 장소 · 2" /><div><span className="eyebrow">NEXT PLACE</span><h3>서울숲 산책길</h3><p><MapPinIcon />서울 성동구 뚝섬로 273</p><footer><button type="button"><MapIcon />길 찾기</button><button className="primary" type="button"><CheckIcon />도착했어요</button></footer></div></section><MapPreview live /></div>
      <section className="flow-card"><Title eyebrow="TODAY FLOW" title="오늘의 흐름"><b>1 / 3</b></Title>{places.map((place,index) => <article className={index === 0 ? 'done' : index === 1 ? 'active' : ''} key={place[1]}><i>{index === 0 ? <CheckIcon /> : index + 1}</i><time>{place[0]}</time><p><b>{place[1]}</b><small>{place[2]}</small></p>{index === 1 && <em>다음</em>}</article>)}</section>
      <button className="quick-photo" onClick={() => move('records')} type="button"><CameraIcon /><p><b>지금의 장면 남기기</b><small>사진은 오늘의 기록에 바로 담겨요</small></p><ChevronRightIcon /></button>
    </div>
  )
}

function Records() {
  return (
    <div className="records-view">
      <Heading eyebrow="MY DAYBOOK" title="우리가 보낸 하루들" text="날짜보다 장면으로 먼저 기억해 보세요." />
      <article className="featured-record"><div className="photo-grid"><Photo className="photo-sunset" /><Photo className="photo-picnic" /><Photo className="photo-river" /></div><div className="record-copy"><span>2026. 8. 27 · 우리 둘의 하루</span><h3>한강 피크닉</h3><p>“노을이 생각보다 오래 남아 있어서 천천히 걸었다.”</p><footer><span><MapPinIcon />여의나루 · 한강공원</span><span><CameraIcon />8</span></footer></div></article>
      <div className="record-list"><RecordCard photo="photo-alley" date="8월 16일 · 나의 하루" title="북촌 기록 산책" text="골목을 따라 걷다가 작은 전시를 만났다." /><RecordCard photo="photo-cafe" date="8월 2일 · 여름 여행" title="친구들과 강릉" text="바다보다 오래 기억날 커피 한 잔." /></div>
    </div>
  )
}

function BottomNav({ screen, move }) {
  const items = [['home','홈',HomeIcon],['calendar','캘린더',CalendarDaysIcon],['plan','일정',ListBulletIcon],['records','기록',BookOpenIcon],['more','더보기',EllipsisHorizontalIcon]]
  return <nav className="bottom-nav">{items.map(([id,label,Icon]) => <button className={screen === id || (screen === 'today' && id === 'home') ? 'on' : ''} key={id} onClick={() => ['home','plan','records'].includes(id) && move(id)} type="button"><Icon /><span>{label}</span></button>)}</nav>
}

function Avatars() { return <span className="avatars"><i>홍</i><i>민</i></span> }
function Progress({ step }) { return <div className="progress"><i className="on" /><i className={step === 2 ? 'on' : ''} /><b>{step} / 2</b></div> }
function Heading({ eyebrow, title, text }) { return <div className="screen-heading"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{text}</p></div> }
function Title({ eyebrow, title, children }) { return <div className="section-title"><div><span className="eyebrow">{eyebrow}</span><h3>{title}</h3></div>{children}</div> }
function Field({ label, children }) { return <label className="field"><span>{label}</span><div>{children}</div></label> }
function Photo({ className = '', label }) { return <div className={`memory-photo ${className}`}>{label && <span>{label}</span>}</div> }
function RecordCard({ photo, date, title, text }) { return <article><Photo className={photo} /><div><span>{date}</span><h3>{title}</h3><p>{text}</p><small>3개 장소</small></div></article> }
function MapPreview({ live = false }) { return <div className="map-preview"><i className="road one" /><i className="road two" />{places.map((place,index) => <b className={`pin pin-${index + 1}`} key={place[1]}>{index + 1}</b>)}{live && <i className="current" />}<p><b>{live ? '서울숲까지 12분' : '3개 장소 · 약 5.4km'}</b><span>{live ? '도보 경로 미리보기' : '선택한 순서대로 표시'}</span></p></div> }
