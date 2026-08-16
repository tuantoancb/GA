export default async function handler(req,res){
  try{
    const url=req.query.url;
    if(!url || !/^https:\/\/docs\.google\.com\/forms\//.test(url)) return res.status(400).json({error:'Link Google Form không hợp lệ.'});
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0'}});
    const html=await r.text();
    if(!r.ok) return res.status(502).json({error:'Google Form trả về lỗi '+r.status});
    const m=html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[.*?\]);\s*<\/script>/s);
    if(!m) return res.status(422).json({error:'Không đọc được cấu trúc Form. Form có thể yêu cầu đăng nhập hoặc Google đã thay đổi định dạng.'});
    const data=JSON.parse(m[1]);
    const fields=[];
    const walk=(node)=>{
      if(!Array.isArray(node)) return;
      // Typical question records contain title at [1], question metadata at [4]
      if(typeof node[1]==='string' && Array.isArray(node[4])){
        const title=node[1];
        const q=node[4][0];
        if(Array.isArray(q) && (typeof q[0]==='number' || typeof q[0]==='string')){
          const entryId=String(q[0]);
          let options=[];
          const collect=(x)=>{if(!Array.isArray(x))return;for(const v of x){if(Array.isArray(v)){if(typeof v[0]==='string' && v[0].length<200) options.push(v[0]); else collect(v)}}};
          collect(q.slice(1));
          options=[...new Set(options)].filter(x=>x && x!==title && !x.startsWith('entry.'));
          fields.push({title,entryId,options:options.slice(0,200)});
        }
      }
      for(const v of node) if(Array.isArray(v)) walk(v);
    };
    walk(data);
    const uniq=[]; const seen=new Set();
    for(const f of fields){const key=f.title+'|'+f.entryId;if(!seen.has(key)){seen.add(key);uniq.push(f)}}
    return res.status(200).json({fields:uniq});
  }catch(e){return res.status(500).json({error:e.message||'Lỗi máy chủ.'})}
}
