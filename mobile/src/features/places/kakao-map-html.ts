export type MapPlace = {
  id: string;
  name: string;
  latitude: string | number | null;
  longitude: string | number | null;
};

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
};

// 사용자 입력이 script 태그를 닫지 못하도록 JSON을 이스케이프한다.
function json(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function mapHtml(key: string, places: MapPlace[], selectedId?: string): string {
  const points = places.map((p, i) => ({ ...p, order: i + 1 })).filter(hasCoordinates);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>*{box-sizing:border-box}html,body,#map{margin:0;width:100%;height:100%;font-family:system-ui;background:#f6f3ed}#status{position:absolute;z-index:10;top:12px;left:12px;right:12px;padding:12px;border-radius:12px;background:white;color:#625b50;font-size:13px}button{font:inherit;cursor:pointer}.pin{border:2px solid white;background:#416a53;color:white;border-radius:18px;padding:7px 10px;box-shadow:0 2px 7px #0003;font-size:12px;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pin.active{background:#b46a3d;transform:scale(1.08)}#retry{margin-left:8px}</style></head>
<body><div id="map" aria-label="장소 지도"></div><div id="status" role="status">지도를 불러오는 중…</div><script>
const points=${json(points)}, selected=${json(selectedId ?? '')}, key=${json(key)};
const status=document.getElementById('status');
function fail(){status.replaceChildren(document.createTextNode('지도를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));const b=document.createElement('button');b.textContent='다시 시도';b.id='retry';b.onclick=()=>location.reload();status.appendChild(b);status.hidden=false;}
let timer=setTimeout(fail,15000);
function send(id){const message=JSON.stringify({type:'kakao-place-select',id});if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);else window.parent.postMessage(message,'*');}
if(!key){clearTimeout(timer);status.textContent='지도를 준비하고 있어요. 장소 목록은 계속 사용할 수 있어요.';}
else{const sdk=document.createElement('script');sdk.src='https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey='+encodeURIComponent(key);sdk.onerror=fail;sdk.onload=()=>{if(!window.kakao||!kakao.maps){fail();return;}kakao.maps.load(()=>{try{
const map=new kakao.maps.Map(document.getElementById('map'),{center:new kakao.maps.LatLng(37.5665,126.978),level:5});
const bounds=new kakao.maps.LatLngBounds();const buttons=[];
points.forEach(p=>{const position=new kakao.maps.LatLng(Number(p.latitude),Number(p.longitude));bounds.extend(position);const button=document.createElement('button');button.className='pin'+(p.id===selected?' active':'');button.textContent=p.order+' '+p.name;button.setAttribute('aria-label',p.order+'번 '+p.name);button.onclick=()=>{buttons.forEach(b=>b.classList.remove('active'));button.classList.add('active');map.panTo(position);send(p.id);};buttons.push(button);new kakao.maps.CustomOverlay({map,position,content:button,yAnchor:1.2});});
function fit(){map.relayout();if(points.length===1){map.setCenter(new kakao.maps.LatLng(Number(points[0].latitude),Number(points[0].longitude)));map.setLevel(3);}else if(points.length>1)map.setBounds(bounds,45,45,45,45);}
fit();if(window.ResizeObserver)new ResizeObserver(fit).observe(document.getElementById('map'));clearTimeout(timer);status.hidden=true;
}catch(_){fail();}});};document.head.appendChild(sdk);}
</script></body></html>`;
}
