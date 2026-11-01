export type MapPlace = {
  id: string;
  name: string;
  latitude: string | number | null;
  longitude: string | number | null;
  /** 여러 일정이 함께 표시되어도 각 일정의 사용자 순서를 유지한다. */
  order?: number;
};

export type HomeMapAppearance = { primary: string; primaryDark: string; bottomInset: number };

/** 마커를 칠할 테마 색. 홈만이 아니라 모든 지도가 사용자가 고른 테마를 따른다. */
export type MarkerColors = { primary: string; primaryDark: string };

// 테마 색을 못 받았을 때 쓰는 기본(로즈) 테마 색.
const DEFAULT_MARKER_COLORS: MarkerColors = { primary: '#CF526B', primaryDark: '#9F3149' };

export function hasCoordinates(place: MapPlace): boolean {
  if (place.latitude === null || place.longitude === null || place.latitude === '' || place.longitude === '') return false;
  const lat = Number(place.latitude);
  const lng = Number(place.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export type MapProps = {
  places: MapPlace[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** 홈처럼 부모 영역을 가득 채워야 하는 지도에서 사용한다. */
  fullBleed?: boolean;
  /** 표시할 장소가 없어도 기본 중심점의 지도를 유지한다. */
  showEmptyMap?: boolean;
  /** 홈 전용 번호 마커. 다른 지도는 기존 마커를 유지한다. */
  homeAppearance?: HomeMapAppearance;
};

// 사용자 입력이 script 태그를 닫지 못하도록 JSON을 이스케이프한다.
function json(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/**
 * 카카오 지도를 그리는 HTML 한 장을 만든다. 앱은 WebView, Expo 웹은 iframe에 넣는다.
 *
 * @param key 카카오 JavaScript 키
 * @param places 지도에 찍을 장소. 좌표가 없는 장소는 건너뛴다
 * @param selectedId 처음에 고른 장소 id
 * @param selectable 지도를 눌러 좌표를 고르는 지도인지 (위치 고르기)
 * @param center 장소가 없을 때의 중심
 * @param homeAppearance 홈 전용 동작(확대 버튼, 바텀시트 높이만큼 중심 보정)
 * @param markerColors 마커 색. 생략하면 기본 로즈 테마 색
 */
export function mapHtml(key: string, places: MapPlace[], selectedId?: string, selectable = false, center = { latitude: 37.5665, longitude: 126.978 }, homeAppearance?: HomeMapAppearance, markerColors: MarkerColors = DEFAULT_MARKER_COLORS): string {
  const points = places.map((p, i) => ({ ...p, order: p.order ?? i + 1 })).filter(hasCoordinates);
  // 마커는 작은 원이다(docs/design-drafts/map-markers B′, 2026-11-01). 가운데 5px 진한 점이 정확한 위치를
  // 찍고, 바깥으로 갈수록 투명해지는 번짐이 지도를 덜 가린다. 고른 장소는 원이 커지고 흰 고리를 두르며
  // 이름표가 위에 뜬다. 원은 작아도 누르는 영역(.pin)은 44px로 둬 손가락으로 누르기 어렵지 않게 한다.
  // --m은 rgba()에 넣으려고 "r,g,b" 형태로 넣는다.
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>*{box-sizing:border-box}html,body,#map{margin:0;width:100%;height:100%;font-family:system-ui;background:#ffffff}#status{position:absolute;z-index:10;top:12px;left:12px;right:12px;padding:12px;border-radius:12px;background:white;color:#625b50;font-size:13px}button{font:inherit;cursor:pointer}.place-marker{position:relative;width:44px;height:44px}.pin{display:flex;width:44px;height:44px;padding:0;border:0;border-radius:50%;background:transparent;align-items:center;justify-content:center}.glow{display:block;width:34px;height:34px;border-radius:50%;flex-shrink:0;background:radial-gradient(circle,rgb(var(--m)) 0 2.5px,transparent 3px),radial-gradient(circle,rgba(var(--m),.75) 0%,rgba(var(--m),.4) 25%,rgba(var(--m),.12) 50%,rgba(var(--m),0) 70%);transition:width .15s,height .15s}.pin.active .glow{width:48px;height:48px;background:radial-gradient(circle,rgb(var(--m)) 0 4px,#fff 4.5px 7px,transparent 7.5px),radial-gradient(circle,rgba(var(--m),.9) 0%,rgba(var(--m),.5) 24%,rgba(var(--m),.16) 48%,rgba(var(--m),0) 70%)}.place-name{display:none;position:absolute;bottom:40px;left:50%;transform:translateX(-50%);max-width:180px;padding:7px 11px;border-radius:14px;background:white;color:var(--marker-dark);box-shadow:0 2px 8px #0002;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.place-marker.active .place-name{display:block}.pin:focus-visible{outline:3px solid #282321;outline-offset:2px}#retry{margin-left:8px}</style></head>
<body><div id="map" aria-label="장소 지도"></div><div id="status" role="status">지도를 불러오는 중…</div><script>
const points=${json(points)}, key=${json(key)}, selectable=${json(selectable)}, center=${json(center)}, home=${json(homeAppearance ?? null)}, colors=${json(markerColors)};
let selected=${json(selectedId ?? '')}, updateSelection=()=>{}, bottomInset=home?.bottomInset??0, updateViewport=()=>{};
window.setSelectedPlace=id=>{selected=points.some(p=>p.id===id)?id:'';updateSelection();};
window.setMapBottomInset=value=>{if(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value!==bottomInset){bottomInset=value;updateViewport();}};
window.addEventListener('message',event=>{if(event.source!==window.parent||event.origin!==window.parent.location.origin)return;try{const message=JSON.parse(event.data);if(message.type==='kakao-set-selection'){window.setMapBottomInset(message.bottomInset);window.setSelectedPlace(message.id);}}catch(_){}});
function rgb(hex){const h=String(hex).replace('#','');const full=h.length===3?h.split('').map(c=>c+c).join(''):h;const n=parseInt(full,16);return Number.isFinite(n)?[(n>>16)&255,(n>>8)&255,n&255].join(','):'207,82,107';}
document.body.style.setProperty('--m',rgb(colors.primary));document.body.style.setProperty('--marker-dark',colors.primaryDark);
const status=document.getElementById('status');
function fail(){status.replaceChildren(document.createTextNode('지도를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));const b=document.createElement('button');b.textContent='다시 시도';b.id='retry';b.onclick=()=>location.reload();status.appendChild(b);status.hidden=false;}
let timer=setTimeout(fail,15000);
function send(id){const message=JSON.stringify({type:'kakao-place-select',id});if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);else window.parent.postMessage(message,'*');}
if(!key){clearTimeout(timer);status.textContent='지도를 준비하고 있어요. 장소 목록은 계속 사용할 수 있어요.';}
else{const sdk=document.createElement('script');sdk.src='https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey='+encodeURIComponent(key);sdk.onerror=fail;sdk.onload=()=>{if(!window.kakao||!kakao.maps){fail();return;}kakao.maps.load(()=>{try{
const map=new kakao.maps.Map(document.getElementById('map'),{center:new kakao.maps.LatLng(center.latitude,center.longitude),level:5});
if(selectable){let marker=null;kakao.maps.event.addListener(map,'click',event=>{if(marker)marker.setMap(null);marker=new kakao.maps.Marker({map,position:event.latLng});const message=JSON.stringify({type:'kakao-coordinate-select',latitude:event.latLng.getLat(),longitude:event.latLng.getLng()});if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);else window.parent.postMessage(message,'*');});}
const bounds=new kakao.maps.LatLngBounds();const markers=[];
points.forEach(p=>{const position=new kakao.maps.LatLng(Number(p.latitude),Number(p.longitude));bounds.extend(position);
const content=document.createElement('div');content.className='place-marker';const label=document.createElement('div');label.className='place-name';label.textContent=points.length>1?p.order+' · '+p.name:p.name;
const button=document.createElement('button');button.className='pin';button.setAttribute('aria-label',p.order+'번 '+p.name);button.title=p.name;const glow=document.createElement('span');glow.className='glow';glow.setAttribute('aria-hidden','true');button.appendChild(glow);content.append(label,button);
button.onclick=()=>{window.setSelectedPlace(p.id);send(p.id);};const overlay=new kakao.maps.CustomOverlay({map,position,content,yAnchor:0.5});markers.push({id:p.id,button,content,position,overlay});});
function inset(){return home?Math.min(bottomInset,document.getElementById('map').clientHeight*0.65):0;}
updateSelection=()=>{markers.forEach(marker=>{const active=marker.id===selected;marker.button.classList.toggle('active',active);marker.button.setAttribute('aria-pressed',String(active));marker.content.classList.toggle('active',active);marker.overlay.setZIndex(active?3:1);});const active=markers.find(marker=>marker.id===selected);if(active){map.setCenter(active.position);if(inset())map.panBy(0,inset()/2);}};
function fit(){map.relayout();if(points.length===1){map.setCenter(new kakao.maps.LatLng(Number(points[0].latitude),Number(points[0].longitude)));map.setLevel(3);if(inset())map.panBy(0,inset()/2);}else if(points.length>1)map.setBounds(bounds,64,45,45+inset(),45);}
updateViewport=()=>{fit();updateSelection();};
if(home)map.addControl(new kakao.maps.ZoomControl(),kakao.maps.ControlPosition.RIGHT);
fit();updateSelection();if(window.ResizeObserver)new ResizeObserver(fit).observe(document.getElementById('map'));clearTimeout(timer);status.hidden=true;
}catch(_){fail();}});};document.head.appendChild(sdk);}
</script></body></html>`;
}
