const SUPABASE_URL="https://inavmauzukbqjsekquxw.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_il1W1s6uNwgcFwGAs4HFHw_AuB-hiaS";
const APP_ROW_ID="main"; // 3 个账号共享这一行数据
const STORAGE_KEY="cat-dog-recipe-supabase-cache-v1";
const uid=()=>window.crypto&&crypto.randomUUID?crypto.randomUUID():"id-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
let supabaseClient=null;
function setLoginMsg(msg){const el=$("#loginMsg");if(el)el.textContent=msg}
function appendLoginMsg(msg){const el=$("#loginMsg");if(el)el.textContent=(el.textContent?el.textContent+"｜":"")+msg}
function ensureSupabaseClient(){
  if(supabaseClient)return supabaseClient;
  if(!window.supabase)throw new Error("Supabase JS 没有加载成功。请检查网络，或确认 index.html 里有 supabase-js 脚本。");
  if(!SUPABASE_URL || SUPABASE_URL.includes("你的项目"))throw new Error("app.js 顶部的 SUPABASE_URL 还没有改成你的项目 URL。");
  if(!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("你的-anon"))throw new Error("app.js 顶部的 SUPABASE_ANON_KEY 还没有改成你的 anon public key / publishable key。");
  if(!/^https:\/\/.+\.supabase\.co\/?$/.test(SUPABASE_URL.trim()))throw new Error("SUPABASE_URL 格式不对，应该类似：https://xxxx.supabase.co");
  if(SUPABASE_ANON_KEY.toLowerCase().includes("service_role") || SUPABASE_ANON_KEY.toLowerCase().includes("secret"))throw new Error("不要使用 service_role / secret key，请使用 anon public key 或 publishable key。");
  supabaseClient=window.supabase.createClient(SUPABASE_URL.trim(),SUPABASE_ANON_KEY.trim(),{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  return supabaseClient;
}
const sampleRecipes=[{id:uid(),name:"番茄牛腩",category:"暖心家常",servings:"3-4人",time:"90分钟",image:"https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",ingredients:[{id:uid(),name:"牛腩",needQty:500,unit:"g",haveQty:0},{id:uid(),name:"番茄",needQty:3,unit:"个",haveQty:3},{id:uid(),name:"土豆",needQty:10,unit:"个",haveQty:3},{id:uid(),name:"鸡蛋",needQty:2,unit:"个",haveQty:0}],steps:"1. 牛腩冷水下锅焯水。\n2. 番茄炒软出汁，加入牛腩翻炒。\n3. 加热水炖煮。"},{id:uid(),name:"香煎鸡腿饭",category:"快手便当",servings:"2人",time:"35分钟",image:"https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=900&q=80",ingredients:[{id:uid(),name:"鸡腿肉",needQty:2,unit:"块",haveQty:0},{id:uid(),name:"米饭",needQty:2,unit:"碗",haveQty:2},{id:uid(),name:"土豆",needQty:2,unit:"个",haveQty:0}],steps:"1. 鸡腿肉腌制。\n2. 小火煎熟。\n3. 配米饭和蔬菜。"},{id:uid(),name:"虾仁滑蛋",category:"儿童友好",servings:"2-3人",time:"15分钟",image:"https://images.unsplash.com/photo-1563379091339-03246963d51a?auto=format&fit=crop&w=900&q=80",ingredients:[{id:uid(),name:"虾仁",needQty:200,unit:"g",haveQty:0},{id:uid(),name:"鸡蛋",needQty:4,unit:"个",haveQty:4},{id:uid(),name:"牛奶",needQty:2,unit:"勺",haveQty:0}],steps:"1. 虾仁处理。\n2. 鸡蛋加牛奶打散。\n3. 小火推炒。"}];
const sampleFridge=[{id:uid(),name:"牛奶",needQty:1,unit:"盒",haveQty:1,inCart:false},{id:uid(),name:"面包",needQty:1,unit:"袋",haveQty:1,inCart:false},{id:uid(),name:"鸡蛋",needQty:10,unit:"个",haveQty:6,inCart:true},{id:uid(),name:"苹果",needQty:6,unit:"个",haveQty:2,inCart:true},{id:uid(),name:"酸奶",needQty:4,unit:"杯",haveQty:0,inCart:true}];
let state=normalize(null),currentRecipeId=null,editingId=null,currentUser=null,isRemoteLoading=false,saveTimer=null;const $=s=>document.querySelector(s);
function num(v){const n=Number(v);return Number.isFinite(n)&&n>=0?n:0}function fmt(q,u=""){const n=num(q),t=Number.isInteger(n)?String(n):String(n).replace(/\.0+$/,"").replace(/(\.\d*[1-9])0+$/,"$1");return `${t}${u?" "+u:""}`.trim()}function buyQty(i){return Math.max(0,num(i.needQty)-num(i.haveQty))}function keyOf(n,u){return `${String(n).trim().toLowerCase()}__${String(u||"").trim().toLowerCase()}`}function parseAmount(s=""){const m=String(s).trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/);return{needQty:m?num(m[1]):0,unit:m?(m[2]||"").trim():""}}function normIng(i){const p=parseAmount(i.amount||""),need=i.needQty!=null?num(i.needQty):p.needQty,unit=(i.unit!=null?i.unit:p.unit||"").trim();let have=i.haveQty!=null?num(i.haveQty):(i.have||i.bought?need:0);return{id:i.id||uid(),name:i.name||"",needQty:need,unit,haveQty:Math.min(have,need||have),amount:fmt(need,unit)}}function normFridge(i){const x=normIng(i);return{...x,inCart:Boolean(i.inCart)||buyQty(x)>0}}function normalize(raw){const src=raw&&Array.isArray(raw.recipes)?raw:{recipes:sampleRecipes,currentRecipeId:sampleRecipes[0].id,fridge:sampleFridge};return{recipes:src.recipes.map(r=>({...r,ingredients:(r.ingredients||[]).map(normIng)})),fridge:Array.isArray(src.fridge)?src.fridge.map(normFridge):sampleFridge.map(normFridge),currentRecipeId:src.currentRecipeId||src.recipes?.[0]?.id}}
function loadLocalState(){try{return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)))}catch{return normalize(null)}}
function setSyncStatus(msg,ok=false){const el=$("#syncStatus");if(el){el.textContent=msg;el.classList.toggle("auth-ok",ok)}}
function save(){state.currentRecipeId=currentRecipeId;localStorage.setItem(STORAGE_KEY,JSON.stringify(state,null,2));queueRemoteSave()}
function queueRemoteSave(){if(!currentUser||isRemoteLoading)return;clearTimeout(saveTimer);setSyncStatus("待同步");saveTimer=setTimeout(saveRemoteNow,650)}
async function saveRemoteNow(){if(!currentUser)return;try{setSyncStatus("同步中...");const payload={id:APP_ROW_ID,data:state,updated_at:new Date().toISOString(),updated_by:currentUser.id};const {error}=await ensureSupabaseClient().from("recipe_app_state").upsert(payload,{onConflict:"id"});if(error)throw error;setSyncStatus("云端已同步",true)}catch(e){console.error(e);setSyncStatus("同步失败");toast("云端同步失败："+(e.message||"请检查 Supabase 设置"))}}
async function loadRemoteState(){isRemoteLoading=true;setSyncStatus("读取云端...");try{const {data,error}=await ensureSupabaseClient().from("recipe_app_state").select("data").eq("id",APP_ROW_ID).maybeSingle();if(error)throw error;state=data?.data?normalize(data.data):loadLocalState();currentRecipeId=state.currentRecipeId||state.recipes[0]?.id||null;render();isRemoteLoading=false;if(!data?.data)await saveRemoteNow();else setSyncStatus("云端已同步",true)}catch(e){console.error(e);state=loadLocalState();currentRecipeId=state.currentRecipeId||state.recipes[0]?.id||null;render();isRemoteLoading=false;setSyncStatus("离线缓存");toast("读取云端失败，已显示本机缓存："+(e.message||""))}}
function showAuth(msg=""){currentUser=null;$("#authScreen").hidden=false;$("#appMain").hidden=true;$("#loginMsg").textContent=msg;$("#loginPassword").value=""}
async function enterApp(user){currentUser=user;$("#accountEmail").textContent=user.email||"已登录";$("#authScreen").hidden=true;$("#appMain").hidden=false;await loadRemoteState()}
async function handleLogin(e){
  e.preventDefault();
  const email=$("#loginEmail").value.trim();
  const password=$("#loginPassword").value;
  const btn=$("#loginBtn");
  if(!email||!password){setLoginMsg("请填写邮箱和密码");return}
  btn.disabled=true;
  setLoginMsg("1/3 正在检查 Supabase 配置...");
  try{
    const client=ensureSupabaseClient();
    appendLoginMsg("2/3 正在登录...");
    const {data,error}=await withTimeout(
      client.auth.signInWithPassword({email,password}),
      LOGIN_TIMEOUT_MS,
      "登录超时：请检查网络、Supabase URL/key，或 Supabase Auth 设置"
    );
    if(error)throw error;
    const user=data?.user||data?.session?.user;
    if(!user)throw new Error("登录成功但没有返回用户信息，请检查 Supabase Auth 设置。");
    appendLoginMsg("3/3 登录成功，正在进入...");
    await enterApp(user);
  }catch(err){
    console.error(err);
    setLoginMsg("登录失败："+(err.message||"账号或密码不正确"));
  }finally{
    btn.disabled=false;
  }
}
async function handleLogout(){clearTimeout(saveTimer);await saveRemoteNow();if(supabaseClient) await supabaseClient.auth.signOut();showAuth("已退出登录")}
async function initAuth(){
  try{
    const client=ensureSupabaseClient();
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    if(data.session?.user)await enterApp(data.session.user);else showAuth();
    client.auth.onAuthStateChange((_event,session)=>{if(!session?.user&&currentUser)showAuth("登录状态已失效，请重新登录")});
  }catch(err){
    console.error(err);
    showAuth("初始化失败："+(err.message||""));
  }
}
