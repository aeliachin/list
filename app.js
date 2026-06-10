const SUPABASE_URL="https://你的项目.supabase.co";
const SUPABASE_ANON_KEY="你的-anon-public-key";
const APP_ROW_ID="main";
const STORAGE_KEY="cat-dog-recipe-supabase-cache-v2";

const uid=()=>window.crypto&&crypto.randomUUID?crypto.randomUUID():"id-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
const $=s=>document.querySelector(s);
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});

const sampleRecipes=[
  {id:uid(),name:"番茄牛腩",category:"暖心家常",servings:"3-4人",time:"90分钟",ingredients:[{id:uid(),name:"牛腩",needQty:500,unit:"g",haveQty:0},{id:uid(),name:"番茄",needQty:3,unit:"个",haveQty:3},{id:uid(),name:"土豆",needQty:2,unit:"个",haveQty:1},{id:uid(),name:"鸡蛋",needQty:2,unit:"个",haveQty:0}],steps:"1. 牛腩冷水下锅焯水。\n2. 番茄炒软出汁，加入牛腩翻炒。\n3. 加热水炖煮。"},
  {id:uid(),name:"香煎鸡腿饭",category:"快手便当",servings:"2人",time:"35分钟",ingredients:[{id:uid(),name:"鸡腿肉",needQty:2,unit:"块",haveQty:0},{id:uid(),name:"米饭",needQty:2,unit:"碗",haveQty:2},{id:uid(),name:"西兰花",needQty:1,unit:"颗",haveQty:0}],steps:"1. 鸡腿肉腌制。\n2. 小火煎熟。\n3. 配米饭和蔬菜。"},
  {id:uid(),name:"虾仁滑蛋",category:"儿童友好",servings:"2-3人",time:"15分钟",ingredients:[{id:uid(),name:"虾仁",needQty:200,unit:"g",haveQty:0},{id:uid(),name:"鸡蛋",needQty:4,unit:"个",haveQty:4},{id:uid(),name:"牛奶",needQty:2,unit:"勺",haveQty:0}],steps:"1. 虾仁处理。\n2. 鸡蛋加牛奶打散。\n3. 小火推炒。"}
];
const sampleFridge=[
  {id:uid(),name:"牛奶",needQty:1,unit:"盒",haveQty:1,inCart:false},
  {id:uid(),name:"面包",needQty:1,unit:"袋",haveQty:1,inCart:false},
  {id:uid(),name:"鸡蛋",needQty:10,unit:"个",haveQty:6,inCart:true},
  {id:uid(),name:"苹果",needQty:6,unit:"个",haveQty:2,inCart:true},
  {id:uid(),name:"酸奶",needQty:4,unit:"杯",haveQty:0,inCart:true}
];

let state=normalize(null);
let currentRecipeId=null;
let editingId=null;
let currentUser=null;
let isRemoteLoading=false;
let saveTimer=null;

function num(v){const n=Number(v);return Number.isFinite(n)&&n>=0?n:0}
function fmt(q,u=""){const n=num(q),t=Number.isInteger(n)?String(n):String(n).replace(/\.0+$/," ").trim().replace(/(\.\d*[1-9])0+$/,"$1");return `${t}${u?" "+u:""}`.trim()}
function buyQty(i){return Math.max(0,num(i.needQty)-num(i.haveQty))}
function keyOf(n,u){return `${String(n).trim().toLowerCase()}__${String(u||"").trim().toLowerCase()}`}
function esc(s=""){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function parseAmount(s=""){const m=String(s).trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/);return{needQty:m?num(m[1]):0,unit:m?(m[2]||"").trim():""}}
function normIng(i){const p=parseAmount(i.amount||"");const need=i.needQty!=null?num(i.needQty):p.needQty;const unit=(i.unit!=null?i.unit:p.unit||"").trim();const have=i.haveQty!=null?num(i.haveQty):(i.have||i.bought?need:0);return{id:i.id||uid(),name:i.name||"",needQty:need,unit,haveQty:Math.min(have,need||have),amount:fmt(need,unit)}}
function normFridge(i){const x=normIng(i);return{...x,inCart:Boolean(i.inCart)||buyQty(x)>0}}
function normalize(raw){
  const src=raw&&Array.isArray(raw.recipes)?raw:{recipes:sampleRecipes,currentRecipeId:sampleRecipes[0].id,fridge:sampleFridge};
  return {
    recipes:(src.recipes||[]).map(r=>({
      ...r,
      image:"",
      ingredients:(r.ingredients||[]).map(normIng)
    })),
    fridge:Array.isArray(src.fridge)?src.fridge.map(normFridge):sampleFridge.map(normFridge),
    currentRecipeId:src.currentRecipeId||src.recipes?.[0]?.id||sampleRecipes[0].id
  };
}
function loadLocalState(){try{return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)))}catch{return normalize(null)}}
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),1700)}

function hashCode(str=""){
  return [...String(str)].reduce((a,c)=>((a<<5)-a)+c.codePointAt(0),0);
}
function splitTitle(title=""){
  if(title.length<=4)return [title,""];
  const cut=Math.ceil(title.length/2);
  return [title.slice(0,cut),title.slice(cut)];
}
function recipeIcons(recipe){
  const text=`${recipe.name} ${recipe.category||""} ${(recipe.ingredients||[]).map(i=>i.name).join(" ")}`;
  const rules=[
    [/番茄|西红柿/,["🍅","🥘","🥄"]],[/牛|牛腩|牛肉/,["🥩","🥘","🍲"]],[/鸡|鸡腿|鸡胸/,["🍗","🍚","🥬"]],[/虾|海鲜/,["🍤","🦐","🍽️"]],[/蛋/,["🥚","🍳","✨"]],[/鱼/,["🐟","🍲","🥬"]],[/面|面条/,["🍜","🥢","✨"]],[/饭|便当/,["🍚","🍱","🥢"]],[/汤|粥/,["🍲","🥄","✨"]],[/沙拉/,["🥗","🥬","🍋"]],[/土豆/,["🥔","🧄","🥘"]],[/牛奶|奶/,["🥛","🍮","✨"]]
  ];
  const found=[];
  rules.forEach(([re,icons])=>{if(re.test(text))icons.forEach(icon=>{if(!found.includes(icon))found.push(icon)})});
  if(found.length<3)["🍽️","✨","🥢","🥘"].forEach(icon=>{if(found.length<3&&!found.includes(icon))found.push(icon)});
  return found.slice(0,3);
}
function recipePalette(recipe){
  const palettes=[
    ["#fff4d8","#ffd2cc","#ff8e72","#7b2d26"],
    ["#e3f7ff","#c7e9d2","#7cd7c6","#114b5f"],
    ["#fff0f4","#ffd0de","#f59fb5","#6b2740"],
    ["#f3f0ff","#d8d0ff","#a79bff","#32235f"],
    ["#f4ffe3","#dff3a6","#9bdb4d","#3d5220"],
    ["#fff4e7","#ffd9a8","#ffb05c","#7d4b16"]
  ];
  return palettes[Math.abs(hashCode((recipe.name||"")+(recipe.category||"")))%palettes.length];
}
function svgDataUri(svg){return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`}
function coverForRecipe(recipe){
  const [bg1,bg2,accent,ink]=recipePalette(recipe);
  const [icon1,icon2,icon3]=recipeIcons(recipe);
  const [line1,line2]=splitTitle(recipe.name||"菜谱");
  const sub=(recipe.category|| (recipe.ingredients||[]).slice(0,2).map(i=>i.name).join(" · ") || "家庭菜谱").slice(0,18);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <rect width="900" height="620" rx="32" fill="url(#g)"/>
    <circle cx="725" cy="118" r="90" fill="${accent}" fill-opacity="0.2"/>
    <circle cx="810" cy="430" r="120" fill="#ffffff" fill-opacity="0.22"/>
    <circle cx="150" cy="95" r="58" fill="#ffffff" fill-opacity="0.28"/>
    <rect x="56" y="60" rx="20" ry="20" width="180" height="44" fill="#ffffff" fill-opacity="0.72"/>
    <text x="146" y="89" font-size="22" text-anchor="middle" fill="${ink}" font-family="Arial, PingFang SC, Microsoft YaHei" font-weight="700">猫狗菜谱</text>
    <ellipse cx="640" cy="360" rx="150" ry="150" fill="#ffffff" fill-opacity="0.95"/>
    <ellipse cx="640" cy="380" rx="178" ry="62" fill="${accent}" fill-opacity="0.85"/>
    <ellipse cx="640" cy="364" rx="138" ry="38" fill="#fff6ed"/>
    <text x="566" y="350" font-size="78">${icon1}</text>
    <text x="636" y="332" font-size="96">${icon2}</text>
    <text x="710" y="352" font-size="76">${icon3}</text>
    <rect x="58" y="396" rx="28" ry="28" width="362" height="150" fill="#ffffff" fill-opacity="0.72"/>
    <text x="84" y="452" font-size="56" fill="${ink}" font-family="Arial, PingFang SC, Microsoft YaHei" font-weight="800">${esc(line1)}</text>
    ${line2?`<text x="84" y="514" font-size="56" fill="${ink}" font-family="Arial, PingFang SC, Microsoft YaHei" font-weight="800">${esc(line2)}</text>`:""}
    <rect x="60" y="560" rx="16" ry="16" width="230" height="34" fill="${accent}" fill-opacity="0.16"/>
    <text x="175" y="584" font-size="22" text-anchor="middle" fill="${ink}" font-family="Arial, PingFang SC, Microsoft YaHei" font-weight="700">${esc(sub)}</text>
  </svg>`;
  return svgDataUri(svg);
}

function setSyncStatus(msg,ok=false){const el=$("#syncStatus");if(el){el.textContent=msg;el.classList.toggle("auth-ok",ok)}}
function save(){state.currentRecipeId=currentRecipeId;localStorage.setItem(STORAGE_KEY,JSON.stringify(state,null,2));queueRemoteSave()}
function queueRemoteSave(){if(!currentUser||isRemoteLoading)return;clearTimeout(saveTimer);setSyncStatus("待同步");saveTimer=setTimeout(saveRemoteNow,650)}
async function saveRemoteNow(){
  if(!currentUser)return;
  try{
    setSyncStatus("同步中...");
    const payload={id:APP_ROW_ID,data:state,updated_at:new Date().toISOString(),updated_by:currentUser.id};
    const {error}=await supabaseClient.from("recipe_app_state").upsert(payload,{onConflict:"id"});
    if(error)throw error;
    setSyncStatus("云端已同步",true);
  }catch(e){
    console.error(e);
    setSyncStatus("同步失败");
    toast("云端同步失败："+(e.message||"请检查 Supabase 设置"));
  }
}
async function loadRemoteState(){
  isRemoteLoading=true;
  setSyncStatus("读取云端...");
  try{
    const {data,error}=await supabaseClient.from("recipe_app_state").select("data").eq("id",APP_ROW_ID).maybeSingle();
    if(error)throw error;
    state=data?.data?normalize(data.data):loadLocalState();
    currentRecipeId=state.currentRecipeId||state.recipes[0]?.id||null;
    render();
    isRemoteLoading=false;
    if(!data?.data)await saveRemoteNow(); else setSyncStatus("云端已同步",true);
  }catch(e){
    console.error(e);
    state=loadLocalState();
    currentRecipeId=state.currentRecipeId||state.recipes[0]?.id||null;
    render();
    isRemoteLoading=false;
    setSyncStatus("离线缓存");
    toast("读取云端失败，已显示本机缓存："+(e.message||""));
  }
}
function showAuth(msg=""){currentUser=null;$("#authScreen").hidden=false;$("#appMain").hidden=true;$("#loginMsg").textContent=msg;$("#loginPassword").value=""}
async function enterApp(user){currentUser=user;$("#accountEmail").textContent=user.email||"已登录";$("#authScreen").hidden=true;$("#appMain").hidden=false;await loadRemoteState()}
async function handleLogin(e){
  e.preventDefault();
  const email=$("#loginEmail").value.trim();
  const password=$("#loginPassword").value;
  $("#loginBtn").disabled=true;
  $("#loginMsg").textContent="登录中...";
  try{
    const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
    if(error)throw error;
    $("#loginMsg").textContent="";
    await enterApp(data.user);
  }catch(err){
    $("#loginMsg").textContent="登录失败："+(err.message||"账号或密码不正确");
  }finally{$("#loginBtn").disabled=false}
}
async function handleLogout(){clearTimeout(saveTimer);await saveRemoteNow();await supabaseClient.auth.signOut();showAuth("已退出登录")}
async function initAuth(){
  if(SUPABASE_URL.includes("你的项目")||SUPABASE_ANON_KEY.includes("你的-anon")){$("#loginMsg").textContent="请先在 app.js 顶部填写 SUPABASE_URL 和 SUPABASE_ANON_KEY";return}
  const {data}=await supabaseClient.auth.getSession();
  if(data.session?.user)await enterApp(data.session.user); else showAuth();
  supabaseClient.auth.onAuthStateChange((_event,session)=>{if(!session?.user&&currentUser)showAuth("登录状态已失效，请重新登录")});
}

function render(){renderRecipes();renderPrep();renderCart();renderFridge();save()}
function filteredRecipes(){
  const k=$("#searchInput").value.trim().toLowerCase();
  if(!k)return state.recipes;
  return state.recipes.filter(r=>[r.name,r.category,r.servings,r.time,...r.ingredients.map(i=>i.name)].join(" ").toLowerCase().includes(k));
}
function recipeImage(r){return coverForRecipe(r)}
function renderRecipes(){
  const rs=filteredRecipes();
  $("#recipeCount").textContent=`${rs.length} 道菜`;
  $("#recipeGrid").innerHTML=rs.length?rs.map(r=>{
    const need=r.ingredients.filter(i=>buyQty(i)>0).length;
    return `<article class="card"><div class="img" style="background-image:url('${recipeImage(r)}')"></div><div class="body"><div class="row"><div><h3 style="margin:0 0 7px">${esc(r.name)}</h3><div class="meta">⏱ ${esc(r.time||"未填")}　🍽 ${esc(r.servings||"未填")}</div></div><span class="tag">${esc(r.category||"家庭")}</span></div><div class="chips">${r.ingredients.slice(0,5).map(i=>`<span class="chip">${esc(i.name)}</span>`).join("")}</div><div class="actions"><button class="btn" onclick="selectRecipe('${r.id}',true)">${need?`待买 ${need}`:"已备齐"}</button><button class="btn yellow" onclick="openEditor('${r.id}')">编辑</button></div></div></article>`;
  }).join(""):`<div class="empty">没有找到菜谱。</div>`;
}
function renderPrep(){
  const r=state.recipes.find(x=>x.id===currentRecipeId)||state.recipes[0];
  if(!r){$("#prepDetail").innerHTML=`<div class="empty">还没有菜谱。</div>`;return}
  currentRecipeId=r.id;
  $("#prepDetail").innerHTML=`<div class="panel detail"><div class="detail-img" style="background-image:url('${recipeImage(r)}')"></div><div><span class="tag">${esc(r.category||"家庭")}</span><h2>${esc(r.name)}</h2><div class="meta">⏱ ${esc(r.time||"未填")}　🍽 ${esc(r.servings||"未填")}　🛒 ${r.ingredients.filter(i=>buyQty(i)>0).length} 件待买</div><div class="actions" style="margin-top:16px"><button class="btn yellow" onclick="switchTab('cart')">去购物车</button><button class="btn light" onclick="openEditor('${r.id}')">编辑菜谱</button></div></div></div><div class="panel"><div class="head" style="margin:0 0 12px"><h2>用料检查</h2><small>点 X 表示缺少</small></div><div class="list">${r.ingredients.map(i=>{const b=buyQty(i);return `<div class="item ${b===0?"ready":""}"><button class="xbtn ${b>0?"active":""}" onclick="markMissing('${r.id}','${i.id}')">×</button><div><div class="name">${esc(i.name)}</div><div class="small">需要：${fmt(i.needQty,i.unit)}</div><div class="small">家里已有：${fmt(i.haveQty,i.unit)}</div><div class="small">还需购买：${fmt(b,i.unit)}</div></div><div class="qtybox"><div class="small">家里已有数量</div><div class="qtyline"><input class="qty" type="number" min="0" max="${i.needQty}" step="0.1" value="${i.haveQty}" onchange="setHaveQty('${r.id}','${i.id}',this.value)"><span class="badge">${esc(i.unit||"数量")}</span></div></div><span class="badge ok">${b===0?"已足够":`差 ${fmt(b,i.unit)}`}</span></div>`}).join("")}</div></div><div class="panel"><h2 style="margin-top:0">做法</h2><div style="white-space:pre-wrap;line-height:1.8">${esc(r.steps||"还没有填写做法。")}</div></div>`;
}
function collectCartGroups(){
  const map=new Map(),raw=[];
  state.recipes.forEach(r=>r.ingredients.forEach(i=>{const b=buyQty(i);if(b>0)raw.push({type:"recipe",source:r.name,recipeId:r.id,itemId:i.id,name:i.name,unit:i.unit,qty:b})}));
  state.fridge.forEach(i=>{const b=i.inCart?Math.max(1,buyQty(i)||i.needQty||1):buyQty(i);if(i.inCart||b>0)raw.push({type:"fridge",source:"冰箱",itemId:i.id,name:i.name,unit:i.unit,qty:b})});
  raw.forEach(x=>{const k=keyOf(x.name,x.unit);if(!map.has(k))map.set(k,{key:k,name:x.name,unit:x.unit,total:0,items:[]});const g=map.get(k);g.total+=x.qty;g.items.push(x)});
  return{groups:[...map.values()],raw};
}
function renderCart(){
  const {groups,raw}=collectCartGroups();
  $("#cartNeedCount").textContent=groups.length;
  $("#cartRawCount").textContent=raw.length;
  if(!groups.length){$("#cartList").innerHTML=`<div class="empty">购物车为空。备菜或冰箱中点击 X，食材会出现在这里。</div>`;return}
  $("#cartList").innerHTML=`<div class="panel"><h3>合并待采购</h3><div class="list">${groups.map((g,idx)=>{const inputId=`group-buy-${idx}`;const sources=g.items.map(x=>`${x.source} ${fmt(x.qty,x.unit)}`).join("；");return `<div class="item"><div><div class="name">${esc(g.name)}</div><div class="small">合计待买：${fmt(g.total,g.unit)}</div><div class="small">来源：${esc(sources)}</div></div><div class="qtybox"><div class="small">本次采购数量</div><div class="qtyline"><input id="${inputId}" class="qty" type="number" min="0" max="${g.total}" step="0.1" value="${g.total}"><button class="mini" onclick="applyGroupPurchased('${g.key}','${inputId}')">记为已采购</button></div></div></div>`}).join("")}</div></div>`;
}
function renderFridge(){
  const html=state.fridge.map(i=>{const b=i.inCart?Math.max(1,buyQty(i)||i.needQty||1):buyQty(i);return `<div class="item ${!i.inCart&&b===0?"ready":""}"><button class="xbtn ${i.inCart||b>0?"active":""}" onclick="addFridgeToCart('${i.id}')">×</button><div><div class="name">${esc(i.name)}</div><div class="small">目标常备：${fmt(i.needQty,i.unit)}</div><div class="small">当前已有：${fmt(i.haveQty,i.unit)}</div><div class="small">状态：${i.inCart||b>0?`购物车待买 ${fmt(b,i.unit)}`:"暂不购买"}</div></div><div class="qtybox"><div class="small">当前已有数量</div><div class="qtyline"><input class="qty" type="number" min="0" step="0.1" value="${i.haveQty}" onchange="setFridgeHave('${i.id}',this.value)"><span class="badge">${esc(i.unit||"数量")}</span></div><button class="mini" onclick="editFridgeTarget('${i.id}')">改目标</button></div></div>`}).join("");
  $("#fridgeList").innerHTML=html?`<div class="panel"><div class="list">${html}</div></div>`:`<div class="empty">冰箱还没有常用食材。</div>`;
}

function selectRecipe(id,go=false){currentRecipeId=id;render();if(go)switchTab("prep")}
function findItem(rid,iid){return state.recipes.find(r=>r.id===rid)?.ingredients.find(i=>i.id===iid)}
function setHaveQty(rid,iid,v){const i=findItem(rid,iid);if(!i)return;i.haveQty=Math.min(num(v),i.needQty);render();toast("已更新家里已有数量")}
function markMissing(rid,iid){const i=findItem(rid,iid);if(!i)return;if(buyQty(i)===0)i.haveQty=0;currentRecipeId=rid;render();toast("已同步到购物车")}
function addQtyToItem(target,qty){if(qty<=0)return 0;if(target.type==="recipe"){const i=findItem(target.recipeId,target.itemId),b=buyQty(i),add=Math.min(qty,b);i.haveQty=Math.min(i.needQty,i.haveQty+add);return add}else{const i=state.fridge.find(x=>x.id===target.itemId),add=qty;i.haveQty+=add;if(i.haveQty>=i.needQty)i.inCart=false;return add}}
function applyGroupPurchased(groupKey,inputId){let qty=num(document.getElementById(inputId)?.value);if(qty<=0){toast("请输入采购数量");return}const g=collectCartGroups().groups.find(x=>x.key===groupKey);if(!g)return;for(const item of g.items){if(qty<=0)break;const used=addQtyToItem(item,qty);qty-=used}render();toast("已按来源自动分配并同步")}
function addFridgeToCart(id){const i=state.fridge.find(x=>x.id===id);if(!i)return;i.inCart=true;if(buyQty(i)===0)i.haveQty=0;render();toast("已同步到购物车")}
function setFridgeHave(id,v){const i=state.fridge.find(x=>x.id===id);if(!i)return;i.haveQty=num(v);i.inCart=buyQty(i)>0;render();toast("冰箱数量已更新")}
function addFridgeItem(){const input=$("#fridgeNameField"),name=input.value.trim();if(!name){toast("请输入食材名称");return}state.fridge.unshift({id:uid(),name,needQty:1,unit:"份",haveQty:0,inCart:false});input.value="";render();toast("已加入冰箱")}
function editFridgeTarget(id){const i=state.fridge.find(x=>x.id===id);if(!i)return;const q=prompt(`目标常备数量：${i.name}`,i.needQty);if(q===null)return;const u=prompt(`单位：${i.name}`,i.unit||"份");i.needQty=num(q)||1;i.unit=(u||i.unit||"份").trim();i.inCart=buyQty(i)>0;render();toast("目标数量已更新")}
function switchTab(tab){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===tab));scrollTo({top:0,behavior:"smooth"})}
function openEditor(id=null){
  editingId=id;
  const r=state.recipes.find(x=>x.id===id);
  $("#dialogTitle").textContent=r?"编辑菜谱":"添加菜谱";
  $("#nameField").value=r?.name||"";
  $("#categoryField").value=r?.category||"";
  $("#servingsField").value=r?.servings||"";
  $("#timeField").value=r?.time||"";
  $("#ingredientsField").value=r?.ingredients?.map(i=>`${i.name} | ${i.needQty} | ${i.unit}`).join("\n")||"";
  $("#stepsField").value=r?.steps||"";
  $("#recipeDialog").showModal();
}
function parseIngredients(text,old=[]){
  return text.split("\n").map(x=>x.trim()).filter(Boolean).map(line=>{
    const [n="",q="",u=""]=line.split("|");
    const name=n.trim();
    const oldItem=old.find(i=>i.name===name);
    const need=num(q.trim());
    return {id:oldItem?.id||uid(),name,needQty:need,unit:u.trim(),haveQty:Math.min(oldItem?.haveQty||0,need),amount:fmt(need,u.trim())};
  }).filter(i=>i.name);
}
function handleSubmit(e){
  e.preventDefault();
  const old=state.recipes.find(r=>r.id===editingId);
  const recipe={
    id:old?.id||uid(),
    name:$("#nameField").value.trim(),
    category:$("#categoryField").value.trim(),
    servings:$("#servingsField").value.trim(),
    time:$("#timeField").value.trim(),
    image:"",
    ingredients:parseIngredients($("#ingredientsField").value,old?.ingredients||[]),
    steps:$("#stepsField").value.trim()
  };
  if(!recipe.name||!recipe.ingredients.length){toast("请填写菜名和用料");return}
  if(old)state.recipes[state.recipes.findIndex(x=>x.id===editingId)]=recipe; else state.recipes.unshift(recipe);
  currentRecipeId=recipe.id;
  $("#recipeDialog").close();
  render();
  toast("菜谱已保存，并自动生成封面");
}
async function shareShoppingList(){
  const {groups}=collectCartGroups();
  if(!groups.length){toast("没有待采购内容");return}
  const text="猫狗菜谱｜待采购清单\n\n"+groups.map((g,n)=>`${n+1}. ${g.name} - ${fmt(g.total,g.unit)}（${g.items.map(x=>x.source).join("、")}）`).join("\n");
  if(navigator.share){
    try{await navigator.share({title:"待采购清单",text});toast("已打开分享菜单")}
    catch(e){if(e.name!=="AbortError")copyText(text)}
  }else copyText(text)
}
async function copyText(text){
  try{await navigator.clipboard.writeText(text)}
  catch{const t=document.createElement("textarea");t.value=text;document.body.appendChild(t);t.select();document.execCommand("copy");t.remove()}
  toast("待采购清单已复制，可以粘贴发送")
}

function bindUI(){
  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  $("#searchInput").addEventListener("input",renderRecipes);
  $("#addRecipeBtn").addEventListener("click",()=>openEditor());
  $("#closeDialog").addEventListener("click",()=>$("#recipeDialog").close());
  $("#cancelBtn").addEventListener("click",()=>$("#recipeDialog").close());
  $("#recipeForm").addEventListener("submit",handleSubmit);
  $("#loginForm").addEventListener("submit",handleLogin);
  $("#logoutBtn").addEventListener("click",handleLogout);
  Object.assign(window,{selectRecipe,setHaveQty,markMissing,applyGroupPurchased,switchTab,openEditor,shareShoppingList,addFridgeToCart,setFridgeHave,addFridgeItem,editFridgeTarget});
}

bindUI();
initAuth();
