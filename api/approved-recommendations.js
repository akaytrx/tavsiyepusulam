// Public read endpoint: returns only moderator-approved recommendations.
export default async function handler(req,res){
 res.setHeader('Cache-Control','public, max-age=0, s-maxage=60');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Yalnızca GET destekleniyor.'});}
 const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)return res.status(503).json({error:'Servis yapılandırması eksik.'});
 try{
  const endpoint=url.replace(/\/$/,'')+'/rest/v1/recommendations?select=id,venue_name,district,category,description&status=eq.approved&order=created_at.desc&limit=100';
  const response=await fetch(endpoint,{headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json'}});
  if(!response.ok){console.error('Approved recommendations fetch:',response.status);return res.status(502).json({error:'Tavsiyeler yüklenemedi.'});}
  const recommendations=await response.json();
  return res.status(200).json({recommendations});
 }catch(err){console.error('Approved recommendations API:',err?.message);return res.status(502).json({error:'Tavsiyeler yüklenemedi.'});}
}
