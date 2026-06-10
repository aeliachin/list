const SUPABASE_URL="https://inavmauzukbqjsekquxw.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_il1W1s6uNwgcFwGAs4HFHw_AuB-hiaS";

const APP_ROW_ID="main";
const STORAGE_KEY="family-recipe-supabase-cache-v8";
const LOGIN_TIMEOUT_MS=15000;

let supabaseClient=null;
const uid=()=>window.crypto&&crypto.randomUUID?crypto.randomUUID():"id-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
const $=s=>document.querySelector(s);

const sampleRecipes=[
  {id:uid(),name:"番茄牛腩",category:"暖心家常",servings:"3-4人",time:"90分钟",ingredients:[{id:uid(),name:"牛腩",needQty:500,unit:"g",haveQty:0},{id:uid(),name:"番茄",needQty:3,unit:"个",haveQty:3},{id:uid(),name:"土豆",needQty:2,unit:"个",haveQty:1},{id:uid(),name:"胡萝卜",needQty:1,unit:"根",haveQty:0}],steps:"1. 牛腩冷水下锅焯水。\n2. 番茄炒软出汁，加入牛腩翻炒。\n3. 加热水炖煮。"},
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

const DIRECTORY_HERO={
  recipes:{badge:"菜谱目录",title:"今天想做哪道菜？",text:"这里集中管理所有家庭菜单，点击菜谱进入备菜检查。",image:"https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80"},
  prep:{badge:"备菜目录",title:"把缺少的食材一次检查清楚",text:"按菜谱核对已有数量，缺少项会自动同步到购物车。",image:"https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80"},
  cart:{badge:"购物车目录",title:"购物车里装满食材，采购更直观",text:"同名食材会自动合并，像装满食材的购物车一样一目了然。",image:"https://images.unsplash.com/photo-1542838132-c7b4f7a29710?auto=format&fit=crop&w=1200&q=80"},
  fridge:{badge:"冰箱目录",title:"家里常备食材，一眼看清",text:"管理牛奶、鸡蛋、水果等常用食材，需要补货时直接进购物车。",image:"https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1200&q=80"}
};

let state=normalize(null);
let currentRecipeId=null;
let editingId=null;
let currentUser=null;
let isRemoteLoading=false;
let saveTimer=null;

function num(v){const n=Number(v);return Number.isFinite(n)&&n>=0?n:0}
function fmt(q,u=""){const n=num(q);const t=Number.isInteger(n)?String(n):String(n).replace(/\.0+$/,'').replace(/(\.\d*[1-9])0+$/,'$1');return `${t}${u?" "+u:""}`.trim()}
function buyQty(i){return Math.max(0,num(i.needQty)-num(i.haveQty))}
function keyOf(n,u){return `${String(n).trim().toLowerCase()}__${String(u||"").trim().toLowerCase()}`}
function esc(s=""){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function parseAmount(s=""){const m=String(s).trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/);return{needQty:m?num(m[1]):0,unit:m?(m[2]||"").trim():""}}
function normIng(i){const p=parseAmount(i.amount||"");const need=i.needQty!=null?num(i.needQty):p.needQty;const unit=(i.unit!=null?i.unit:p.unit||"").trim();const have=i.haveQty!=null?num(i.haveQty):(i.have||i.bought?need:0);return{id:i.id||uid(),name:i.name||"",needQty:need,unit,haveQty:Math.min(have,need||have),amount:fmt(need,unit)}}
function normFridge(i){const x=normIng(i);return{...x,inCart:Boolean(i.inCart)||buyQty(x)>0}}
function normalize(raw){const src=raw&&Array.isArray(raw.recipes)?raw:{recipes:sampleRecipes,currentRecipeId:sampleRecipes[0].id,fridge:sampleFridge};return{recipes:(src.recipes||[]).map(r=>({...r,image:"",ingredients:(r.ingredients||[]).map(normIng)})),fridge:Array.isArray(src.fridge)?src.fridge.map(normFridge):sampleFridge.map(normFridge),currentRecipeId:src.currentRecipeId||src.recipes?.[0]?.id||sampleRecipes[0].id}}
function loadLocalState(){try{return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)))}catch{return normalize(null)}}
function toast(msg){const el=$("#toast");if(!el)return;el.textContent=msg;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),1900)}
function setLoginMsg(msg){const el=$("#loginMsg");if(el)el.textContent=msg}
function appendLoginMsg(msg){const el=$("#loginMsg");if(el)el.textContent=(el.textContent?el.textContent+"｜":"")+msg}
function setHero(tab){const d=DIRECTORY_HERO[tab]||DIRECTORY_HERO.recipes;$("#heroBadge").textContent=d.badge;$("#heroTitle").textContent=d.title;$("#heroText").textContent=d.text;$("#heroPicture").style.backgroundImage=`url('${d.image}')`}

function ensureSupabaseClient(){if(supabaseClient)return supabaseClient;if(!window.supabase)throw new Error("Supabase JS 没有加载成功。");if(!SUPABASE_URL||SUPABASE_URL.includes("你的项目"))throw new Error("app.js 顶部的 SUPABASE_URL 还没有改。");if(!SUPABASE_ANON_KEY||SUPABASE_ANON_KEY.includes("你的-anon"))throw new Error("app.js 顶部的 SUPABASE_ANON_KEY 还没有改。");supabaseClient=window.supabase.createClient(SUPABASE_URL.trim(),SUPABASE_ANON_KEY.trim(),{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});return supabaseClient}
function withTimeout(promise,ms,message){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(message)),ms))])}
function setSyncStatus(msg,ok=false){const el=$("#syncStatus");if(el){el.textContent=msg;el.classList.toggle("auth-ok",ok)}}
function save(){state.currentRecipeId=currentRecipeId;localStorage.setItem(STORAGE_KEY,JSON.stringify(state,null,2));queueRemoteSave()}
function queueRemoteSave(){if(!currentUser||isRemoteLoading)return;clearTimeout(saveTimer);setSyncStatus("待同步");saveTimer=setTimeout(saveRemoteNow,700)}
async function saveRemoteNow(){if(!currentUser)return;try{setSyncStatus("同步中...");const payload={id:APP_ROW_ID,data:state,updated_at:new Date().toISOString(),updated_by:currentUser.id};const {error}=await ensureSupabaseClient().from("recipe_app_state").upsert(payload,{onConflict:"id"});if(error)throw error;setSyncStatus("云端已同步",true)}catch(e){console.error(e);setSyncStatus("同步失败");toast("云端同步失败："+(e.message||"请检查 Supabase 设置"))}}
async function loadRemoteState(){isRemoteLoading=true;setSyncStatus("读取云端...");try{const {data,error}=await ensureSupabaseClient().from("recipe_app_state").select("data").eq("id",APP_ROW_ID).maybeSingle();if(error)throw error;state=data?.data?normalize(data.data):loadLocalState();currentRecipeId=state.currentRecipeId||state.recipes[0]?.id||null;render();if(!data?.data)await saveRemoteNow();else setSyncStatus("云端已同步",true)}catch(e){console.error(e);state=loadLocalState();currentRecipeId=state.currentRecipeId||state.recipes[0]?.id||null;render();setSyncStatus("离线缓存");toast("读取云端失败，已显示本机缓存："+(e.message||""))}finally{isRemoteLoading=false}}
function showAuth(msg=""){
  currentUser=null;
  const auth=$("#authScreen");
  const main=$("#appMain");
  if(auth){auth.hidden=false;auth.style.display="grid";}
  if(main){main.hidden=true;main.style.display="none";}
  setLoginMsg(msg);
  $("#loginPassword").value="";
}
async function enterApp(user){
  currentUser=user;
  $("#accountEmail").textContent=user.email||"已登录";
  const auth=$("#authScreen");
  const main=$("#appMain");
  if(auth){auth.hidden=true;auth.style.display="none";}
  if(main){main.hidden=false;main.style.display="block";}
  window.scrollTo({top:0,behavior:"auto"});
  await loadRemoteState();
  if(auth){auth.hidden=true;auth.style.display="none";}
  if(main){main.hidden=false;main.style.display="block";}
  window.scrollTo({top:0,behavior:"auto"});
}
async function handleLogin(e){e.preventDefault();const email=$("#loginEmail").value.trim();const password=$("#loginPassword").value;const btn=$("#loginBtn");if(!email||!password){setLoginMsg("请填写邮箱和密码");return}btn.disabled=true;setLoginMsg("1/3 正在检查 Supabase 配置...");try{const client=ensureSupabaseClient();appendLoginMsg("2/3 正在登录...");const {data,error}=await withTimeout(client.auth.signInWithPassword({email,password}),LOGIN_TIMEOUT_MS,"登录超时：请检查网络、Supabase URL/key 或 Auth 设置");if(error)throw error;const user=data?.user||data?.session?.user;if(!user)throw new Error("登录成功但没有返回用户信息。");appendLoginMsg("3/3 登录成功，正在进入...");await enterApp(user)}catch(err){console.error(err);setLoginMsg("登录失败："+(err.message||"账号或密码不正确"))}finally{btn.disabled=false}}
async function handleLogout(){clearTimeout(saveTimer);await saveRemoteNow();if(supabaseClient)await supabaseClient.auth.signOut();showAuth("已退出登录")}
async function initAuth(){try{setHero("recipes");const client=ensureSupabaseClient();const {data,error}=await client.auth.getSession();if(error)throw error;if(data.session?.user)await enterApp(data.session.user);else showAuth();client.auth.onAuthStateChange((_event,session)=>{if(!session?.user&&currentUser)showAuth("登录状态已失效，请重新登录")})}catch(err){console.error(err);showAuth("初始化失败："+(err.message||""))}}

function render(){renderRecipes();renderPrep();renderCart();renderFridge();save()}
function filteredRecipes(){const k=$("#searchInput").value.trim().toLowerCase();if(!k)return state.recipes;return state.recipes.filter(r=>[r.name,r.category,r.servings,r.time,...r.ingredients.map(i=>i.name)].join(" ").toLowerCase().includes(k))}
function renderRecipes(){const rs=filteredRecipes();$("#recipeCount").textContent=`${rs.length} 道菜`;$("#recipeGrid").innerHTML=rs.length?rs.map(r=>{const need=r.ingredients.filter(i=>buyQty(i)>0).length;return `<article class="card"><div class="body"><div class="row"><div><h3 style="margin:0 0 7px">${esc(r.name)}</h3><div class="meta">⏱ ${esc(r.time||"未填")}　🍽 ${esc(r.servings||"未填")}</div></div><button class="icon-btn" onclick="deleteRecipe('${r.id}')" title="删除菜谱">🗑</button></div><div class="chips">${r.ingredients.slice(0,5).map(i=>`<span class="chip">${esc(i.name)}</span>`).join("")}</div><div class="row" style="margin-bottom:12px"><span class="tag">${esc(r.category||"家庭")}</span><div class="small">${need?`待买 ${need} 项`:"食材已备齐"}</div></div><div class="recipe-actions"><button class="btn" onclick="selectRecipe('${r.id}',true)">查看</button><button class="btn yellow" onclick="openEditor('${r.id}')">编辑</button><button class="btn soft-danger" onclick="deleteRecipe('${r.id}')">删除</button></div></div></article>`}).join(""):`<div class="empty">没有找到菜谱。</div>`}
function renderPrep(){const r=state.recipes.find(x=>x.id===currentRecipeId)||state.recipes[0];if(!r){$("#prepDetail").innerHTML=`<div class="empty">还没有菜谱。</div>`;return}currentRecipeId=r.id;$("#prepDetail").innerHTML=`<div class="panel detail"><div class="detail-cover"><div><b>${esc(r.name)}</b><div class="meta" style="margin-top:10px">⏱ ${esc(r.time||"未填")}　🍽 ${esc(r.servings||"未填")}　🛒 ${r.ingredients.filter(i=>buyQty(i)>0).length} 件待买</div></div></div><div><span class="tag">${esc(r.category||"家庭")}</span><h2>${esc(r.name)}</h2><div class="actions" style="margin-top:16px"><button class="btn yellow" onclick="switchTab('cart')">去购物车</button><button class="btn light" onclick="openEditor('${r.id}')">编辑菜谱</button></div><div class="actions" style="margin-top:10px"><button class="btn soft-danger" onclick="deleteRecipe('${r.id}')">删除这道菜谱</button><button class="btn" onclick="switchTab('recipes')">返回菜谱</button></div></div></div><div class="panel"><div class="head" style="margin:0 0 12px"><h2>用料检查</h2><small>点 X 表示缺少</small></div><div class="list">${r.ingredients.map(i=>{const b=buyQty(i);return `<div class="item ${b===0?"ready":""}"><button class="xbtn ${b>0?"active":""}" onclick="markMissing('${r.id}','${i.id}')">×</button><div><div class="name">${esc(i.name)}</div><div class="small">需要：${fmt(i.needQty,i.unit)}</div><div class="small">家里已有：${fmt(i.haveQty,i.unit)}</div><div class="small">还需购买：${fmt(b,i.unit)}</div></div><div class="qtybox"><div class="small">家里已有数量</div><div class="qtyline"><input class="qty" type="number" min="0" max="${i.needQty}" step="0.1" value="${i.haveQty}" onchange="setHaveQty('${r.id}','${i.id}',this.value)"><span class="badge">${esc(i.unit||"数量")}</span></div></div><span class="badge ok">${b===0?"已足够":`差 ${fmt(b,i.unit)}`}</span></div>`}).join("")}</div></div><div class="panel"><h2 style="margin-top:0">做法</h2><div style="white-space:pre-wrap;line-height:1.8">${esc(r.steps||"还没有填写做法。")}</div></div>`}
function collectCartGroups(){const map=new Map(),raw=[];state.recipes.forEach(r=>r.ingredients.forEach(i=>{const b=buyQty(i);if(b>0)raw.push({type:"recipe",source:r.name,recipeId:r.id,itemId:i.id,name:i.name,unit:i.unit,qty:b})}));state.fridge.forEach(i=>{const b=i.inCart?Math.max(1,buyQty(i)||i.needQty||1):buyQty(i);if(i.inCart||b>0)raw.push({type:"fridge",source:"冰箱",itemId:i.id,name:i.name,unit:i.unit,qty:b})});raw.forEach(x=>{const k=keyOf(x.name,x.unit);if(!map.has(k))map.set(k,{key:k,name:x.name,unit:x.unit,total:0,items:[]});const g=map.get(k);g.total+=x.qty;g.items.push(x)});return{groups:[...map.values()],raw}}
function renderCart(){
  const {groups,raw}=collectCartGroups();
  $("#cartNeedCount").textContent=groups.length;
  $("#cartRawCount").textContent=raw.length;
  if(!groups.length){
    $("#cartList").innerHTML=`<div class="empty">购物车为空。备菜或冰箱中点击 X，食材会出现在这里。</div>`;
    return;
  }
  $("#cartList").innerHTML=`<div class="panel"><h3>合并待采购</h3><div class="list">${groups.map((g,idx)=>{
    const inputId=`group-buy-${idx}`;
    const sourceLines=g.items.map(x=>`<div class="source-line">${esc(x.source)} <b>${fmt(x.qty,x.unit)}</b></div>`).join("");
    return `<div class="item cart-item">
      <div class="cart-info">
        <div class="name">${esc(g.name)}</div>
        <div class="small">合计待买：${fmt(g.total,g.unit)}</div>
        <div class="small source-list"><span>来源：</span>${sourceLines}</div>
      </div>
      <div class="cart-buybox">
        <div class="small">本次采购数量</div>
        <div class="cart-controls">
          <input id="${inputId}" class="qty cart-qty" type="number" min="0" max="${g.total}" step="0.1" value="${g.total}">
          <button class="mini cart-mini" onclick="applyGroupPurchased('${g.key}','${inputId}')">记为已采购</button>
        </div>
      </div>
    </div>`;
  }).join("")}</div></div>`;
}
function renderFridge(){const html=state.fridge.map(i=>{const b=i.inCart?Math.max(1,buyQty(i)||i.needQty||1):buyQty(i);return `<div class="item ${!i.inCart&&b===0?"ready":""}"><button class="xbtn ${i.inCart||b>0?"active":""}" onclick="addFridgeToCart('${i.id}')">×</button><div><div class="name">${esc(i.name)}</div><div class="small">目标常备：${fmt(i.needQty,i.unit)}</div><div class="small">当前已有：${fmt(i.haveQty,i.unit)}</div><div class="small">状态：${i.inCart||b>0?`购物车待买 ${fmt(b,i.unit)}`:"暂不购买"}</div></div><div class="qtybox"><div class="small">当前已有数量</div><div class="qtyline"><input class="qty" type="number" min="0" step="0.1" value="${i.haveQty}" onchange="setFridgeHave('${i.id}',this.value)"><span class="badge">${esc(i.unit||"数量")}</span></div><button class="mini" onclick="editFridgeTarget('${i.id}')">改目标</button></div></div>`}).join("");$("#fridgeList").innerHTML=html?`<div class="panel"><div class="list">${html}</div></div>`:`<div class="empty">冰箱还没有常用食材。</div>`}

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
function switchTab(tab){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===tab));setHero(tab);window.scrollTo({top:0,behavior:"smooth"})}
function openEditor(id=null){editingId=id;const r=state.recipes.find(x=>x.id===id);$("#dialogTitle").textContent=r?"编辑菜谱":"添加菜谱";$("#nameField").value=r?.name||"";$("#categoryField").value=r?.category||"";$("#servingsField").value=r?.servings||"";$("#timeField").value=r?.time||"";$("#ingredientsField").value=r?.ingredients?.map(i=>`${i.name} | ${i.needQty} | ${i.unit}`).join("\n")||"";$("#stepsField").value=r?.steps||"";$("#recipeDialog").showModal()}
function parseIngredients(text,old=[]){return text.split("\n").map(x=>x.trim()).filter(Boolean).map(line=>{const [n="",q="",u=""]=line.split("|");const name=n.trim(),oldItem=old.find(i=>i.name===name),need=num(q.trim());return{id:oldItem?.id||uid(),name,needQty:need,unit:u.trim(),haveQty:Math.min(oldItem?.haveQty||0,need),amount:fmt(need,u.trim())}}).filter(i=>i.name)}
function handleSubmit(e){e.preventDefault();const old=state.recipes.find(r=>r.id===editingId);const recipe={id:old?.id||uid(),name:$("#nameField").value.trim(),category:$("#categoryField").value.trim(),servings:$("#servingsField").value.trim(),time:$("#timeField").value.trim(),image:"",ingredients:parseIngredients($("#ingredientsField").value,old?.ingredients||[]),steps:$("#stepsField").value.trim()};if(!recipe.name||!recipe.ingredients.length){toast("请填写菜名和用料");return}if(old)state.recipes[state.recipes.findIndex(x=>x.id===editingId)]=recipe;else state.recipes.unshift(recipe);currentRecipeId=recipe.id;$("#recipeDialog").close();render();toast("菜单已保存")}
function deleteRecipe(id){const recipe=state.recipes.find(r=>r.id===id);if(!recipe)return;if(!confirm(`确定删除菜谱“${recipe.name}”吗？`))return;state.recipes=state.recipes.filter(r=>r.id!==id);currentRecipeId=state.recipes[0]?.id||null;switchTab("recipes");render();toast("菜谱已删除")}
async function shareShoppingList(){const {groups}=collectCartGroups();if(!groups.length){toast("没有待采购内容");return}const text="家庭食谱｜待采购清单\n\n"+groups.map((g,n)=>`${n+1}. ${g.name} - ${fmt(g.total,g.unit)}（${g.items.map(x=>x.source).join("、")}）`).join("\n");if(navigator.share){try{await navigator.share({title:"待采购清单",text});toast("已打开分享菜单")}catch(e){if(e.name!=="AbortError")copyText(text)}}else copyText(text)}
async function copyText(text){try{await navigator.clipboard.writeText(text)}catch{const t=document.createElement("textarea");t.value=text;document.body.appendChild(t);t.select();document.execCommand("copy");t.remove()}toast("待采购清单已复制，可以粘贴发送")}

function bindUI(){document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));$("#searchInput").addEventListener("input",renderRecipes);$("#addRecipeBtn").addEventListener("click",()=>openEditor());$("#closeDialog").addEventListener("click",()=>$("#recipeDialog").close());$("#cancelBtn").addEventListener("click",()=>$("#recipeDialog").close());$("#recipeForm").addEventListener("submit",handleSubmit);$("#loginForm").addEventListener("submit",handleLogin);$("#logoutBtn").addEventListener("click",handleLogout);Object.assign(window,{selectRecipe,setHaveQty,markMissing,applyGroupPurchased,switchTab,openEditor,shareShoppingList,addFridgeToCart,setFridgeHave,addFridgeItem,editFridgeTarget,deleteRecipe})}

bindUI();
initAuth();
