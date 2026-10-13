export type MapPlace = {
  id: string;
  name: string;
  latitude: string | number | null;
  longitude: string | number | null;
  /** 여러 일정이 함께 표시되어도 각 일정의 사용자 순서를 유지한다. */
  order?: number;
};

export type HomeMapAppearance = { primary: string; primaryDark: string; bottomInset: number };

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

export function mapHtml(key: string, places: MapPlace[], selectedId?: string, selectable = false, center = { latitude: 37.5665, longitude: 126.978 }, homeAppearance?: HomeMapAppearance): string {
  const points = places.map((p, i) => ({ ...p, order: p.order ?? i + 1 })).filter(hasCoordinates);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>*{box-sizing:border-box}html,body,#map{margin:0;width:100%;height:100%;font-family:system-ui;background:#ffffff}#status{position:absolute;z-index:10;top:12px;left:12px;right:12px;padding:12px;border-radius:12px;background:white;color:#625b50;font-size:13px}button{font:inherit;cursor:pointer}.pin{border:2px solid white;background:#416a53;color:white;border-radius:18px;padding:7px 10px;box-shadow:0 2px 7px #0003;font-size:12px;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pin.active{background:#b46a3d;transform:scale(1.08)}.place-marker{position:relative;display:flex;justify-content:center}.pin.number-pin{width:38px;height:38px;padding:0;background:#A49A97;border-radius:50% 50% 50% 0;transform:rotate(-45deg);font-size:16px;font-weight:700;overflow:visible}.number-pin span{display:block;transform:rotate(45deg)}.pin.number-pin.active{background:var(--home-primary);transform:rotate(-45deg) scale(1.12)}.place-name{display:none;position:absolute;bottom:50px;left:50%;transform:translateX(-50%);max-width:180px;padding:7px 11px;border-radius:14px;background:white;color:var(--home-primary-dark);box-shadow:0 2px 8px #0002;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.place-marker.active .place-name{display:block}.pin:focus-visible{outline:3px solid #282321;outline-offset:4px}#retry{margin-left:8px}</style></head>
<body><div id="map" aria-label="장소 지도"></div><div id="status" role="status">지도를 불러오는 중…</div><script>
const points=${json(points)}, key=${json(key)}, selectable=${json(selectable)}, center=${json(center)}, home=${json(homeAppearance ?? null)};
let selected=${json(selectedId ?? '')}, updateSelection=()=>{}, bottomInset=home?.bottomInset??0, updateViewport=()=>{};
window.setSelectedPlace=id=>{selected=points.some(p=>p.id===id)?id:'';updateSelection();};
window.setMapBottomInset=value=>{if(typeof value==='number'&&Number.isFinite(value)&&value>=0&&value!==bottomInset){bottomInset=value;updateViewport();}};
window.addEventListener('message',event=>{if(event.source!==window.parent||event.origin!==window.parent.location.origin)return;try{const message=JSON.parse(event.data);if(message.type==='kakao-set-selection'){window.setMapBottomInset(message.bottomInset);window.setSelectedPlace(message.id);}}catch(_){}});
if(home){document.body.style.setProperty('--home-primary',home.primary);document.body.style.setProperty('--home-primary-dark',home.primaryDark);}
const status=document.getElementById('status');
function fail(){status.replaceChildren(document.createTextNode('지도를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));const b=document.createElement('button');b.textContent='다시 시도';b.id='retry';b.onclick=()=>location.reload();status.appendChild(b);status.hidden=false;}
let timer=setTimeout(fail,15000);
function send(id){const message=JSON.stringify({type:'kakao-place-select',id});if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);else window.parent.postMessage(message,'*');}
if(!key){clearTimeout(timer);status.textContent='지도를 준비하고 있어요. 장소 목록은 계속 사용할 수 있어요.';}
else{const sdk=document.createElement('script');sdk.src='https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey='+encodeURIComponent(key);sdk.onerror=fail;sdk.onload=()=>{if(!window.kakao||!kakao.maps){fail();return;}kakao.maps.load(()=>{try{
const map=new kakao.maps.Map(document.getElementById('map'),{center:new kakao.maps.LatLng(center.latitude,center.longitude),level:5});
if(selectable){let marker=null;kakao.maps.event.addListener(map,'click',event=>{if(marker)marker.setMap(null);marker=new kakao.maps.Marker({map,position:event.latLng});const message=JSON.stringify({type:'kakao-coordinate-select',latitude:event.latLng.getLat(),longitude:event.latLng.getLng()});if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);else window.parent.postMessage(message,'*');});}
const bounds=new kakao.maps.LatLngBounds();const markers=[];
points.forEach(p=>{const position=new kakao.maps.LatLng(Number(p.latitude),Number(p.longitude));bounds.extend(position);const button=document.createElement('button');button.className='pin'+(home?' number-pin':'');button.setAttribute('aria-label',p.order+'번 '+p.name);button.title=p.name;let content=button;
if(home){content=document.createElement('div');content.className='place-marker';const label=document.createElement('div');label.className='place-name';label.textContent=p.name;const number=document.createElement('span');number.textContent=p.order;button.appendChild(number);content.append(label,button);}else button.textContent=p.order+' '+p.name;
button.onclick=()=>{window.setSelectedPlace(p.id);send(p.id);};const overlay=new kakao.maps.CustomOverlay({map,position,content,yAnchor:1.2});markers.push({id:p.id,button,content,position,overlay});});
function inset(){return home?Math.min(bottomInset,document.getElementById('map').clientHeight*0.65):0;}
updateSelection=()=>{markers.forEach(marker=>{const active=marker.id===selected;marker.button.classList.toggle('active',active);marker.button.setAttribute('aria-pressed',String(active));marker.content.classList.toggle('active',active);marker.overlay.setZIndex(active?3:1);});const active=markers.find(marker=>marker.id===selected);if(active){map.setCenter(active.position);if(inset())map.panBy(0,inset()/2);}};
function fit(){map.relayout();if(points.length===1){map.setCenter(new kakao.maps.LatLng(Number(points[0].latitude),Number(points[0].longitude)));map.setLevel(3);if(inset())map.panBy(0,inset()/2);}else if(points.length>1)map.setBounds(bounds,64,45,45+inset(),45);}
updateViewport=()=>{fit();updateSelection();};
if(home)map.addControl(new kakao.maps.ZoomControl(),kakao.maps.ControlPosition.RIGHT);
fit();updateSelection();if(window.ResizeObserver)new ResizeObserver(fit).observe(document.getElementById('map'));clearTimeout(timer);status.hidden=true;
}catch(_){fail();}});};document.head.appendChild(sdk);}
</script></body></html>`;
}
